# Vetree — Claude Code Guide

## Project Overview
Vetree (vetree.app) is an evidence-based veterinary research platform built by a solo DVM developer.
It aggregates PubMed articles, enriches them with AI-generated clinical summaries, and serves them to veterinary professionals.

## Stack
- **Frontend/Backend:** Next.js (App Router) hosted on Vercel
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **AI:** Claude Haiku (article enrichment), Claude Sonnet (content agent)
- **Monitoring:** Sentry (@sentry/nextjs@7)
- **Rate limiting:** Upstash Redis (@upstash/ratelimit)
- **Analytics:** Vercel Analytics + custom Supabase page_views table

## Repo & Services
- GitHub: `roikris/vetree`
- Supabase project: `gnykidzijppxvrvvchxq`
- Vercel project: `vetree`
- Live URL: `vetree.app`

## Critical Architecture Rules

### 1. API Routes — ALWAYS add these exports
```ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
```
Edge runtime breaks Supabase client and @anthropic-ai/sdk. Never use edge runtime.

### 2. Client Initialization — ALWAYS inside the function
```ts
// ❌ WRONG - breaks serverless cold starts, causes 404
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
export async function POST() { ... }

// ✅ CORRECT
export async function POST() {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  ...
}
```

### 3. Admin Routes — Use service role key
```ts
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // bypasses RLS
)
```

### 4. Supabase Array Filtering
```ts
// ✅ CORRECT syntax for array contains
.not('labels', 'cs', '["equine"]')   // JSON array string format
// ❌ WRONG
.not('labels', 'cs', '{"equine"}')   // curly braces don't work
```
When filtering is complex, fetch broader set and filter in JavaScript.

### 5. GitHub Actions — PAT Required
Workflow dispatch via API requires `GITHUB_PAT` with `workflow` scope.
Stored in Vercel env vars and GitHub Secrets.

### 6. generateStaticParams incompatible with edge runtime
OG images use Node.js runtime + ISR hybrid (pre-builds top 100 articles).

## Environment Variables (Vercel + GitHub Secrets)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
SENTRY_DSN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
NCBI_API_KEY
GITHUB_PAT
SLACK_WEBHOOK_URL
```

## Commands
```bash
npm run dev        # local dev
npm run build      # verify before pushing
git add . && git commit -m "..." && git push  # deploy to Vercel
```
Always run `npm run build` and confirm it passes before committing.

## Auth & Admin
- Admin user ID: `90cb8294-b593-4144-a9f5-23ca52dd5e35` (Roi)
- Admin check: query `user_roles` table WHERE `role = 'admin'`
- `useAdmin` hook: `lib/hooks/useAdmin.ts`
- Email verification enforced in `middleware.ts`

## Enrichment Pipeline
- GitHub Action: `enrich-articles.yml` runs every 4 hours
- Cap: `enrichment_attempts < 3` (normal) OR `force_retry = true` (admin override)
- Articles hidden from public until: `needs_enrichment = false` AND `summary IS NOT NULL`
- Failed enrichment tools at `/admin/pipeline`

## Growth Tools (`/admin/growth`)
- **Content Agent**: On-demand social media post generation using Claude Sonnet
  - Generates platform-specific posts (Twitter, LinkedIn, Facebook, Instagram, WhatsApp, Telegram)
  - Auto-includes UTM tracking parameters in article links
  - Weighted random article selection (prefers newer articles)
  - Redesign feature regenerates posts for different platforms
- **UTM Links**: Campaign link generator with QR codes for tracking traffic sources
- **Growth Tasks (DEPRECATED)**: Daily task system replaced by Content Agent
  - `growth_tasks` table still exists but is no longer actively used
  - `growth-daily-reminder.yml` workflow disabled (kept for reference)
