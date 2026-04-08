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
| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/enrich-articles` | POST | PubMed enrichment | GitHub Action |
| `/api/enrich-failed` | POST | Re-queue failed articles | Admin session |
| `/api/delete-account` | POST | GDPR deletion | User session |
| `/api/growth/generate-post` | POST | AI content agent | Admin session |
| `/api/growth/feedback` | POST | Approve/skip feedback | Admin |
| `/api/growth/stats` | GET | Agent learning stats | Admin |
| `/api/growth/generate-image` | POST | Gemini image generation | Admin |
| `/api/analytics/track` | POST | Log page view | Public |
| `/api/analytics/search` | POST | Log search query | Public |
| `/api/admin/analytics/aggregate` | POST | Daily snapshot | DIGEST_SECRET |
| `/api/admin/analytics/signals` | POST | Signal extraction | DIGEST_SECRET |
| `/api/admin/analytics/insights` | POST | Weekly LLM analysis | DIGEST_SECRET |
| `/api/admin/security/scan` | POST | Security audit | DIGEST_SECRET |
| `/api/admin/digest/trigger` | POST | Manual digest trigger | Admin session |
| `/api/admin/feature-flags` | GET/POST | Feature flag management | Admin |
| `/api/digest/send` | POST | Send weekly email | DIGEST_SECRET |
| `/api/tags/follow` | POST | Follow a tag | User session |
| `/api/tags/unfollow` | DELETE | Unfollow a tag | User session |
| `/api/stats/public` | GET | Public user/article counts | Public |
| `/api/synthesis/generate` | POST | Topic synthesis | Public (feature flagged) |
| `/api/articles/search-quick` | GET | Admin article picker search | Admin |
| `/api/articles/[id]/summary` | GET | Lazy-load article summary | Public |

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
const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const { data: role } = await supabase
  .from('user_roles').select('role').eq('user_id', user.id).single()
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
import { ratelimitModerate } from '@/lib/ratelimit'
const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
const { success } = await ratelimitModerate.limit(ip)
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

## Content Agent — generate-post flow
1. Check feature flag: `topic_synthesis` (for synthesis routes)
2. Fetch preferences from `growth_agent_preferences`
3. Fetch already-used article_ids from `growth_agent_memory` (approved only, last 14 days)
4. Also exclude articles used TODAY across all platforms
5. If `article_id` forced (Generate All mode) → skip article selection, use that article
6. Fetch articles (top 200 by published_date DESC), filter large animal in JS
7. Weighted random selection by recency (exponential decay: weight = 0.95^index)
8. Call Claude Sonnet with platform-specific prompt
9. If SKIP_LARGE_ANIMAL response → retry up to 3x (ignore forced article_id on retry)
10. Check length limits (twitter ≤ 280, whatsapp ≤ 400)
11. Embed UTM in article URL
12. Return `{ post_content, article_id, article_title, article_url, labels, hook_line }`

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
1. Check `topic_synthesis` feature flag
2. Normalize query (lowercase, remove stopwords, expand acronyms via normalizeQuery.ts)
3. Check `topic_syntheses` cache (WHERE query_normalized = X AND expires_at > now())
4. If cache hit → increment hit_count, return cached
5. If cache miss:
   - FTS search top 40 articles
   - Label overlap search top 20 articles
   - Merge, deduplicate, filter large animal in JS, take top 15
   - Build evidence packets (id, title, journal, year, clinical_bottom_line only)
   - Call Claude Sonnet with numbered citation instructions
   - Validate citations (no hallucinated IDs)
   - Convert [1] → clickable links to /article/[id]
   - Cache result for 7 days
6. Return `{ synthesis_html, articles, study_type_breakdown, from_cache }`

## Analysis Agent Flow
1. Daily (02:00 UTC): `/api/admin/analytics/aggregate` → SQL aggregation → `analytics_daily_snapshot`
2. Daily (02:00 UTC): `/api/admin/analytics/signals` → signal extraction → `analytics_signals`
3. Friday (12:00 UTC): `/api/admin/analytics/insights` → Claude Sonnet analysis → `analytics_insights` → Slack
4. Critique pass: Claude Haiku reviews insights, removes those scoring < 0.6
5. Report markdown generated for paste into Claude.ai
- Exclude admin ID from ALL analytics queries
- Article views are NOT reliable signals (social promotion bias) — use saves/searches/synthesis

## Security Agent Flow
1. Thursday (19:00 UTC): `/api/admin/security/scan`
2. Checks: RLS status, exposed env vars, missing auth on routes, rate limiting coverage, hallucinated summaries, admin exclusion working
3. For each finding: Claude Haiku generates a Claude Code fix prompt using Vetree patterns
4. Fix prompts must start with: "Read CLAUDE.md, app/api/CLAUDE.md, supabase/CLAUDE.md first. Then:"
5. Save to `security_reports` → Slack notification
