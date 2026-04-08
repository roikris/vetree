# Vetree — Claude Code Guide

## WORK STYLE
- Read this file + app/api/CLAUDE.md + supabase/CLAUDE.md before every task
- Show only changed code, never entire files
- After committing, explain what changed and why — this helps catch mismatches
- Keep explanations focused: what changed, what it affects, what to watch for
- Always run `npm run build` before committing
- Do NOT explore files freely — ask if blocked

## Project Overview
Vetree (vetree.app) is an evidence-based veterinary research platform.
Aggregates PubMed articles, enriches with AI clinical summaries, serves veterinary professionals.
Solo DVM developer. Target: Israeli + international vets.

## Stack
- **Frontend/Backend:** Next.js 16 (App Router, Turbopack) on Vercel
- **Database:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **AI enrichment:** Claude Haiku (articles), Claude Sonnet (content agent, analysis agent)
- **Email:** Resend (from: digest@digest.vetree.app)
- **Monitoring:** Sentry (@sentry/nextjs@7)
- **Rate limiting:** Upstash Redis (@upstash/ratelimit)
- **Analytics:** Vercel Analytics + custom Supabase page_views table
- **Search:** pg_trgm fuzzy search + 3-tier fallback (FTS → ILIKE → trigram RPC)

## Repo & Services
- GitHub: `roikris/vetree`
- Supabase: `gnykidzijppxvrvvchxq`
- Live: `vetree.app`
- Admin: `vetree.app/admin`

## CRITICAL RULES — Never violate these

### 1. API Routes — always add
```ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60  // for routes calling Claude or doing heavy work
```

### 2. Client init — always INSIDE the function
```ts
// ❌ WRONG - causes 404 in serverless
const anthropic = new Anthropic(...)
export async function POST() {}

// ✅ CORRECT
export async function POST() {
  const anthropic = new Anthropic(...)
}
```

### 3. Admin routes — service role key
```ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### 4. Large animal filtering — JS only, NOT Supabase
```ts
// Supabase array syntax unreliable for this
// Always fetch broader set, filter in JS:
const LARGE_ANIMAL = ['Equine','equine','Large Animal','large animal','Livestock','livestock','Poultry','poultry','Food Animal','food animal']
const filtered = articles.filter(a => !a.labels?.some((l: string) => LARGE_ANIMAL.includes(l)))
```

### 5. Supabase nullable columns — use .or() not .neq()
```ts
// ❌ .neq() also excludes NULL rows
.neq('user_id', adminId)

// ✅ Correct
.or(`user_id.is.null,user_id.neq.${adminId}`)
```

### 6. HTTP status codes
- 404 = route not found ONLY (never use for "no data" — use 500)
- 500 = application/data errors
- 429 = rate limited
- 401 = unauthenticated, 403 = forbidden

### 7. Parse Claude JSON responses — always strip markdown fences
```ts
const raw = response.content[0].type === 'text' ? response.content[0].text : ''
const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
const parsed = JSON.parse(clean)
```

### 8. Article list queries — never select('*')
```ts
// ❌ WRONG - fetches summary (long text) unnecessarily
.select('*')

// ✅ CORRECT - only fields needed for card display
.select('id, title, clinical_bottom_line, labels, source_journal, published_date, strength_of_evidence, authors, article_url, doi, pubmed_id')

// Summary is fetched lazily via /api/articles/[id]/summary only when user expands card
```

### 9. Auth pattern for protected routes
```ts
// Use server client to read session from cookies
import { createClient } from '@/lib/supabase/server'
const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// Check admin
const { data: role } = await supabase
  .from('user_roles').select('role').eq('user_id', user.id).single()
if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
RESEND_API_KEY
DIGEST_SECRET
SENTRY_DSN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
NCBI_API_KEY
GITHUB_PAT
SLACK_WEBHOOK_URL
GOOGLE_AI_API_KEY
```

## Auth & Roles
- Admin ID: `90cb8294-b593-4144-a9f5-23ca52dd5e35`
- Admin check: `user_roles` table WHERE `role = 'admin'`
- `useAdmin` hook: `lib/hooks/useAdmin.ts`
- Email verification enforced in `middleware.ts`
- Exclude admin from ALL analytics queries

## Key Features Built
- Article enrichment pipeline (GitHub Action, daily at 02:00 UTC)
- Admin dashboard: /admin (overview, users, reports, pipeline, analytics, growth, security)
- Growth OS: Content Agent + 90-day campaign calendar + Generate All Platforms
- Topic Synthesis: AI evidence synthesis with citations, cached in topic_syntheses table
- Analysis Agent: weekly SQL aggregation → signal extraction → Claude Sonnet insights → Slack
- Security Agent: weekly scan → findings → Claude-generated fix prompts → Slack
- Weekly email digest (Resend, Friday 12:00 UTC, all confirmed users)
- PWA support (manifest, service worker, install prompt)
- Analytics: page_views, search_logs, UTM tracking, retention (DAU/WAU/MAU)
- Follow tags + personalized feed
- Evidence badges (gold/silver/bronze) based on strength_of_evidence
- Schema.org structured data (MedicalScholarlyArticle on article pages)
- SEO: robots.txt, sitemap.ts, canonical tags, OG tags
- Security headers in next.config.js (X-Frame-Options, X-Content-Type-Options, etc.)
- Accessibility: <main> landmark, skip nav link, aria-labels on inputs
- Mobile UI: bottom nav + responsive cards
- Soft registration wall (3 articles free)
- Hero section for guests (hidden for logged-in users)
- Fuzzy search via pg_trgm with 3-tier fallback + synonym mapping
- Articles blacklist (prevents re-adding deleted articles)
- Feature flags table (on/off switches for features)
- Pagination performance: cached journal/evidence filters, no select('*'), lazy summary load

## UTM Pattern
Content Agent auto-embeds UTM in article links:
```ts
const utmParams = {
  twitter: 'utm_source=twitter&utm_medium=social',
  linkedin: 'utm_source=linkedin&utm_medium=social',
  facebook: 'utm_source=facebook&utm_medium=social',
  facebook_il: 'utm_source=facebook&utm_medium=social&utm_campaign=il',
  whatsapp: 'utm_source=whatsapp&utm_medium=social',
  instagram: 'utm_source=instagram&utm_medium=social',
  telegram: 'utm_source=telegram&utm_medium=social',
  tiktok: 'utm_source=tiktok&utm_medium=social',
  threads: 'utm_source=threads&utm_medium=social',
  reddit: 'utm_source=reddit&utm_medium=social',
}
const articleUrl = `https://vetree.app/article/${article.id}?${utmParams[platform]}`
```

## Campaign Calendar
- 90-day rotation (pure JS, no DB writes for todaysTask):
  facebook_il → whatsapp → reddit → linkedin → facebook_intl → twitter → instagram → telegram → tiktok → threads
- Posts generated by Content Agent (not pre-written)
- All platforms use same article per day (article_id forced after first generation)
- Persisted in localStorage:
  - `vetree_campaign_post_YYYY-MM-DD` (today's main platform)
  - `vetree_campaign_post_YYYY-MM-DD_[platform]` (all platforms)
  - `vetree_campaign_approved_YYYY-MM-DD` (approval state)
- GitHub Action: growth-daily-reminder.yml (03:00 UTC = 06:00 Israel)
- todaysTask comes from pure JS rotation, NOT from DB

## Rate Limiting (Upstash)
Applied to: /api/delete-account, /api/growth/generate-post, /api/analytics/track, /api/digest/send
```ts
import { ratelimitStrict/Moderate/Loose } from '@/lib/ratelimit'
const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
const { success } = await ratelimit.limit(ip)
if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
```

## Enrichment Rules
- Cap: enrichment_attempts < 3 (normal) OR force_retry = true
- Skip articles where abstract is null or < 50 chars (quarantine immediately)
- Mark needs_enrichment = false ONLY when BOTH summary AND clinical_bottom_line are populated
- If Claude returns "INSUFFICIENT_ABSTRACT" → quarantine article
- Articles hidden until: needs_enrichment=false AND summary IS NOT NULL AND clinical_bottom_line IS NOT NULL AND (quarantined=false OR quarantined IS NULL)
- Blacklist: check articles_blacklist before inserting; add to blacklist when admin deletes

## Filter Caching (pagination performance)
```ts
// Cache journal and evidence level lists — they rarely change
// Use Next.js unstable_cache with 1 hour revalidation
import { unstable_cache } from 'next/cache'
export const getUniqueJournals = unstable_cache(async () => { ... }, ['unique-journals'], { revalidate: 3600 })
export const getDistinctEvidenceLevels = unstable_cache(async () => { ... }, ['distinct-evidence-levels'], { revalidate: 3600 })
```

## GitHub Actions
| Workflow | Schedule | Purpose |
|----------|----------|---------|
| daily-sync.yml | 06:00 UTC daily | Fetch new PubMed articles |
| enrich-articles.yml | 02:00 UTC daily | Enrich pending articles |
| backfill-articles.yml | Manual | Historical article import |
| weekly-digest.yml | Friday 10:00 UTC | Send email digest |
| growth-daily-reminder.yml | 03:00 UTC daily | Slack reminder for content post |
| analysis-agent.yml | 02:00 UTC daily (aggregate) + Friday 12:00 UTC (insights) | Analytics agent |
| security-agent.yml | Thursday 19:00 UTC | Security scan |
| reset-enrichment.yml | Manual | Reset enrichment flags |
| fix-encoding.yml | Manual | Fix HTML entities |

## Commands
```bash
npm run dev
npm run build   # always run before commit
git add . && git commit -m "..." && git push
```
