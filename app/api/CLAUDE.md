# API Routes Guide

## Standard Template
```ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60  // add for routes calling Claude or doing heavy work

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const body = await request.json()
    // logic
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 })
}
```

## Route Index
Routes verified from `app/api/` directory tree.

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/trigger-enrichment` | POST | Trigger enrichment pipeline | GitHub Action (DIGEST_SECRET) |
| `/api/enrich-failed` | POST | Re-queue failed articles | Admin session |
| `/api/delete-account` | POST | GDPR deletion | User session |
| `/api/save-article` | POST | Save / unsave article | User session |
| `/api/reports` | POST | Submit article report | User session |
| `/api/grove` | GET | Grove feed endpoint | Public |
| `/api/auth/save-consent` | POST | Record analytics consent | User session |
| `/api/avatars/[userId]` | GET | Signed URL for private avatar | User session |
| `/api/articles/[id]/summary` | GET | Lazy-load article summary | Public |
| `/api/articles/[id]/save-count` | GET | Public save count for article | Public |
| `/api/articles/search-quick` | GET | Admin article picker search | Admin |
| `/api/analytics/track` | POST | Log page view | Public |
| `/api/analytics/search` | POST | Log search query | Public |
| `/api/analytics/event` | POST | Log funnel event | Public (admin skipped) |
| `/api/synthesis/generate` | POST | Topic synthesis | Public (feature flagged) |
| `/api/synthesis/feedback` | POST | Helpful/not-relevant feedback | Public |
| `/api/tags/follow` | POST | Follow a tag | User session |
| `/api/tags/unfollow` | DELETE | Unfollow a tag | User session |
| `/api/tags/unsubscribe-all` | POST | Digest opt-out | User session |
| `/api/stats/public` | GET | Public user/article counts | Public |
| `/api/digest/send` | POST | Send weekly email | DIGEST_SECRET |
| `/api/growth/generate-post` | POST | AI content agent | Admin session |
| `/api/growth/feedback` | POST | Approve/skip feedback | Admin |
| `/api/growth/stats` | GET | Agent learning stats | Admin |
| `/api/growth/generate-image` | POST | Gemini image generation | Admin |
| `/api/growth/generate-synthesis-post` | POST | Synthesis-to-post agent | Admin |
| `/api/growth/save-synthesis-post` | POST | Persist synthesis post | Admin |
| `/api/growth/synthesis-opportunities` | GET | Synthesis content gap list | Admin |
| `/api/admin/trigger-digest` | POST | Manual digest trigger | Admin session |
| `/api/admin/feature-flags` | GET/POST | Feature flag management | Admin |
| `/api/admin/fix-incomplete` | POST | Fix incomplete enrichments | Admin |
| `/api/admin/incomplete-count` | GET | Count incomplete articles | Admin |
| `/api/admin/articles/[id]` | GET/PATCH/DELETE | Admin article management | Admin |
| `/api/admin/articles/[id]/labels` | PATCH | Override article labels | Admin |
| `/api/admin/growth/memory/posted-url` | PATCH | Set posted_url on memory row | Admin |
| `/api/admin/growth/recommendations` | GET | AI content recommendations | Admin |
| `/api/admin/analytics/aggregate` | POST | Daily snapshot | DIGEST_SECRET |
| `/api/admin/analytics/signals` | POST | Signal extraction | DIGEST_SECRET |
| `/api/admin/analytics/insights` | POST | Weekly LLM analysis | DIGEST_SECRET |
| `/api/admin/analytics/latest-insights` | GET | Fetch most recent insights | Admin |
| `/api/admin/analytics/insight-feedback` | POST | Implemented/ignored/noted | Admin |
| `/api/admin/analytics/retention` | GET | Retention cohort data | Admin |
| `/api/admin/security/scan` | POST | Security audit | DIGEST_SECRET |
| `/api/admin/linkedin-metrics/upload` | POST | XLSX import | Admin session |
| `/api/admin/linkedin-metrics/rematch` | POST | Re-run article matching | Admin session |
| `/api/admin/linkedin-metrics/funnel` | GET | Funnel analytics | Admin session |
| `/api/admin/linkedin-metrics/[id]` | PATCH/DELETE | Edit/delete a row | Admin session |

## Common Patterns

### Bearer token auth (GitHub Actions → API)
```ts
const authHeader = request.headers.get('authorization')
const token = authHeader?.replace('Bearer ', '')
if (token !== process.env.DIGEST_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Admin session auth
```ts
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const { data: role } = await supabase
  .from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### Trigger GitHub Action
```ts
await fetch(`https://api.github.com/repos/roikris/vetree/actions/workflows/WORKFLOW.yml/dispatches`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.GITHUB_PAT}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ref: 'main' }),
})
```

### Rate limiting
```ts
import { ratelimitModerate, getClientIP } from '@/lib/ratelimit'
const ip = getClientIP(request)
const { success } = await ratelimitModerate.limit(`prefix:${ip}`)
if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
```

### Send email (Resend)
```ts
import { Resend } from 'resend'
// Initialize INSIDE the function
const resend = new Resend(process.env.RESEND_API_KEY)
await resend.emails.send({
  from: 'Vetree <digest@digest.vetree.app>',
  to: user.email,
  subject: '🌿 Your Vetree Weekly Digest',
  html: emailHtml,
})
```

### Parse Claude JSON response
```ts
const raw = response.content[0].type === 'text' ? response.content[0].text : ''
const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
try {
  const parsed = JSON.parse(clean)
} catch {
  // fallback
}
```

### Slack notification
```ts
await fetch(process.env.SLACK_WEBHOOK_URL!, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: '🌿 *Vetree*\nMessage here' })
})
```

## Save-Article Route
`/api/save-article` is a plain POST route — NOT a server action. This is deliberate: server actions
go through Next.js's sequential router action queue; concurrent auth refreshes can queue ahead and
delay the save by 15+ seconds. Plain `fetch()` dispatches immediately.

```ts
// Client: { articleId: string, action: 'save' | 'unsave' }
// Auth: checks user + email_confirmed_at (returns 403 if unverified)
// Duplicate key (23505) on save = already saved = 200 success
// Calls revalidatePath('/library') after successful change
```

## Analytics Events Route
`/api/analytics/event` inserts into `analytics_events` (NOT page_views).
Use for funnel events that are not page navigations.

Admin exclusion mechanism: the route reads the authenticated user via the server Supabase client,
then queries `user_roles` directly. If `role === 'admin'`, returns `{ success: true, tracked: false }`
early. This does NOT use `EXCLUDED_USER_IDS` / `excludedUsersOrFilter()`.

```ts
// Event names in use: save_intent_arrived, save_intent_auth_shown, save_intent_completed, save_intent_resolved
// Body: { event_name: string, article_id?: string, detail?: Record<string, unknown> }
// Always fire-and-forget — route never returns error to caller
```

The route always merges `device: { type: 'mobile'|'desktop', in_app_browser: boolean }` (parsed from
the `user-agent` header) and `ip_hash` (same SHA-256 scheme as `page_views.ip_hash`, never raw IP)
into whatever `detail` the client sent, before insert. `ip_hash` is the dedup key for "unique actors"
on events with no `user_id` (anonymous branches) — same `user_id || ip_hash || 'anon'` precedence
pattern used in the LinkedIn funnel route.

`save_intent_resolved` fires once per `SaveIntentHandler` arrival, at whichever branch it resolves
to — `detail.branch`: `'saved_now' | 'already_saved' | 'auth_shown' | 'save_error'`. Also carries
`auth_state`, `ms_from_arrival` (delta from the `save_intent_arrived` fire), `utm_source`, `utm_content`.
Arrived events without a matching resolved event in the same window are abandonment (see
`getSaveIntentFunnel` in `app/actions/analytics.ts`).

**Never** write synthetic paths to `page_views` for funnel events. Use `analytics_events`.

## Aggregate Hardening (critical — read this before touching aggregate route)
The aggregate route must:
1. Capture error variable on EVERY Supabase query (e.g. `const { data, error }`, not just `const { data }`)
2. Call `fail(label, error)` after each query — `fail()` throws on non-null error → returns 500
3. Abort with 500 if MAU is 0 after computing: guards against writing silent zeros
4. Exclude admin + TEST_USER_ID via `excludedUsersOrFilter()` from ALL queries
5. Never write zeros to the snapshot silently — a zero total_searches is a sensor failure signal

Silent error swallowing (missing error variable) caused two weeks of all-zero snapshots (2026-07-13).

## Content Agent — generate-post flow
1. Fetch preferences from `growth_agent_preferences`
2. Fetch already-used article_ids from `growth_agent_memory` (approved only, last 14 days)
3. Also exclude articles used TODAY across all platforms
4. If `article_id` forced (Generate All mode) → skip article selection, use that article
5. Fetch articles (top 200 by publication_date DESC), filter large animal in JS
6. Weighted random selection by recency (exponential decay: weight = 0.95^index)
7. Call Claude Sonnet with platform-specific prompt
8. If SKIP_LARGE_ANIMAL response → retry up to 3x (ignore forced article_id on retry)
9. Check length limits (twitter ≤ 280, whatsapp ≤ 400)
10. Embed UTM in article URL
11. Return `{ post_content, article_id, article_title, article_url, labels, hook_line }`

## Platform Rules (for prompts)
```ts
const platformRules = {
  twitter: 'MAX 280 chars total. One hook + one insight. Ruthless brevity. BANNED: "game changer", "revolutionary".',
  linkedin: `Rhythm: short→long→short. 150-300 words. No bullets. Human voice.
    BANNED PHRASES: "game changer", "major upgrade", "revolutionary", "groundbreaking",
    "excited to share", "proud to announce". Write like a colleague, not a marketer.`,
  facebook: 'Conversational, 100-200 words. Personal tone.',
  facebook_il: 'Same as facebook but Hebrew. Natural clinical Hebrew.',
  whatsapp: 'Very short, casual. 50-80 words max. Hebrew for IL.',
  instagram: 'Hook + insight + hashtags. 100-150 words.',
  telegram: 'Informative. 100-150 words. Slightly technical ok.',
  tiktok: `Spoken voiceover script, 80-100 words MAX. 30-45 seconds when spoken.
    HOOK VARIETY (rotate): surprising stat / clinical scenario / misconception challenge /
    direct question / patient outcome / research reveal / bold statement.
    BANNED OPENINGS: "Did you know", "Have you ever", "Today we're talking about".
    No hashtags, no bullet points. End with:
    🔗 vetree.app/article/{id}?utm_source=tiktok&utm_medium=social`,
  threads: `ONE of these formats (rotate):
    A) Hot Take — bold clinical opinion + question to reader
    B) Micro-Story — 2-3 paragraph relatable clinical moment
    C) Mini Thread — hook + numbered list of 3-5 insights
    D) Direct Question — finding + specific practice question
    No hashtags. Conversational. 150-300 words.`,
  reddit: 'Informational, evidence-focused. 150-250 words. Community tone.',
}
```

## Topic Synthesis Flow
Search: single RPC call — `search_articles_synthesis(search_query, candidate_limit=50, final_limit=15)`.
This is NOT the 3-tier FTS/ILIKE/trigram used by the main article feed. The RPC does ranked scoring internally.

1. Check `topic_synthesis` feature flag
2. Normalize query (normalizeQuery.ts)
3. Check `topic_syntheses` cache (query_normalized match, expires_at > now, search_version >= 2)
   - Cache entries with < 5 articles are treated as invalid and regenerated
4. Cache miss: call `search_articles_synthesis` RPC (50 candidates → 15 final), filter large animal in JS
5. Abort with `{ insufficient: true }` if fewer than 3 articles remain after filtering
6. Build evidence packets (citation_id, id, title, journal, year, clinical_bottom_line, labels)
7. Call Claude Sonnet — numbered citation instructions, no outside knowledge allowed
8. Validate citations (no hallucinated IDs), convert [N] → clickable /article/[id] links
9. Cache for 7 days with search_version=2
10. Track via `page_views.insert({ path: '/synthesis/run' })` on both cache hit and miss

## Analysis Agent Flow
1. Daily (02:00 UTC): `/api/admin/analytics/aggregate` → SQL aggregation → `analytics_daily_snapshot`
2. Daily (02:00 UTC): `/api/admin/analytics/signals` → signal extraction → `analytics_signals`
3. Friday (12:00 UTC): `/api/admin/analytics/insights` → Claude Sonnet analysis → `analytics_insights` → Slack
4. Critique pass: Claude Sonnet reviews insights, removes those scoring < 0.6
5. Report markdown generated for paste into Claude.ai
- Exclude admin + TEST_USER_ID from ALL analytics queries via `excludedUsersOrFilter()`
- Article views are NOT reliable signals (social promotion bias) — use saves/searches/synthesis
- Signal types: search_gap, churn_risk, content_opportunity, growth_signal, retention_driver, ux_problem, data_gap
- `data_gap` fires when total_searches == 0 in latest snapshot (logging sensor failure)

## Security Agent Flow
1. Thursday (19:00 UTC): `/api/admin/security/scan`
2. 19+ checks: RLS status, exposed env vars, missing auth on routes, rate limiting coverage,
   hallucinated summaries, admin exclusion working, and more
3. CHECK 19 — Browser Supabase singleton in server code:
   - Regex: `/from\s+['"]@\/lib\/supabase\/client['"]/` (NOT string includes — avoids false positives)
   - Self-excludes `app/api/admin/security/scan/route.ts` (its own source matches the pattern)
   - Flags any server file importing `@/lib/supabase/client` (anon key → RLS → silent empty reads)
4. For each finding: Claude Sonnet generates a fix prompt using Vetree patterns
5. Fix prompts must start with: "Read CLAUDE.md, app/api/CLAUDE.md, supabase/CLAUDE.md first. Then:"
6. Save to `security_reports` → Slack notification

## LinkedIn Metrics Routes
`/api/admin/linkedin-metrics/upload` — POST (multipart XLSX)
- Parses impressions + engagements sheets from LinkedIn analytics export
- Runs article matching: activity_id → slug → date → AI (Claude Sonnet)
- Upserts to `linkedin_post_metrics` (idempotent via post_url UNIQUE constraint)
- `match_method` values:
  - `'ai'` — current value written by Claude Sonnet matcher (post-Sonnet migration)
  - `'haiku'` — legacy value on old DB rows (pre-migration); rematch display counter includes both
  - `'activity_id'` | `'slug'` | `'date'` — deterministic matching tiers
  - `'manual'` — admin-corrected in UI
  - `'no_article'` — reshares/group posts with no article
  - `'cleared'` — admin unassigned an erroneous match; article_id nulled, needs (re-)assignment

`/api/admin/linkedin-metrics/rematch` — POST
- Re-runs matching on all rows where match_method not in ('manual', 'no_article', 'cleared')
- 'cleared' rows are excluded deliberately — otherwise a deterministic tier (e.g. date) would
  immediately reassign the same wrong article an admin just unassigned
- Returns counts: `{ slug, date, ai }` (ai bucket counts both 'ai' and legacy 'haiku' rows)

`/api/admin/linkedin-metrics/funnel` — GET
- Aggregate impressions, engagements, matched article count, match rate

`/api/admin/linkedin-metrics/[id]` — PATCH/DELETE
- Admin manually sets article_id (sets match_method = 'manual') or deletes row
- `{ match_method: 'no_article' }` — marks row as having no associated article
- `{ action: 'clear_match' }` — clears article_id and sets match_method = 'cleared';
  logs the previous article_id + match_method server-side before overwriting
