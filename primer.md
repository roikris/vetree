# Vetree — Current State (primer.md)
*Last updated: April 3, 2026*
*Update this file after every Claude Code session*

---

## 🎯 Active Focus
- Synonym mapping fix: "integrative veterinary medicine" + "NSAID" returning 0 results (17.2% zero-result rate)
- Example search chips in hero section (pre-populated clinical terms → auto-synthesis)
- Pagination performance fixes (select('*') → specific fields, cached filters, lazy summary load)
- SEO fixes: meta description, canonical tags, OG tags, robots.txt, sitemap.ts
- Accessibility fixes: <main> landmark, skip nav link, aria-labels
- Security headers added to next.config.js

---

## ✅ Recently Completed
- Security Agent: weekly scan → findings → Claude fix prompts → Slack (/admin/security)
- Analysis Agent: daily SQL aggregation + Friday insights → Slack + /admin/analytics
- Topic Synthesis: AI evidence synthesis with citations, cached, feature-flagged
- Content Agent: Generate All Platforms (same article, batched), Retry Failed, article picker
- TikTok + Threads added to platform rotation and UTM map
- Fuzzy search: pg_trgm + 3-tier fallback + initial synonym mapping
- Articles blacklist: prevents re-adding deleted articles from PubMed
- Security headers: X-Frame-Options, X-Content-Type-Options, Permissions-Policy, COOP
- SEO: robots.txt, sitemap.ts, canonical tags, OG tags
- Accessibility: <main>, skip nav, aria-labels
- Weekly digest: sends to ALL confirmed users, 5-day dedup
- Hero section hidden for logged-in users
- Admin auth added to /api/growth/generate-post
- Veterinary Ophthalmology added to PubMed journal list
- CSP: intentionally skipped for now (too complex, low priority at current scale)

---

## 🐛 Open Bugs / Known Issues
- Zero-result rate 17.2% — "integrative veterinary medicine" and "NSAID" not caught by synonyms
- Malformed/autocomplete queries ("inetgr", "inet") causing zero results — search UX friction
- Zero article saves from real users
- Zero synthesis runs from real users (feature discovery problem)
- Median session 11s vs average 58s — massive bounce rate, most users leave immediately
- DAU/MAU stickiness 1.6% — users not returning after first visit
- Retry Failed platforms still occasionally fails
- Campaign calendar "Mark Done" stats don't always refresh after approve
- GITHUB_PAT token flagged as expiring — needs renewal
- Top Countries showing "Not available" in analytics dashboard

---

## 📋 Next Planned
1. **Synonym fixes** (1h): add "integrative" → holistic/alternative/complementary, "NSAID" → anti-inflammatory/analgesic
2. **Hero search chips** (half-day): clickable pre-populated clinical terms → auto-trigger search + synthesis
3. Verify pagination fixes deployed (no jump-back, fade overlay working)
4. Verify robots.txt and sitemap.xml accessible
5. Submit sitemap to Google Search Console
6. Anonymous synthesis run before signup wall
7. Re-engagement section in digest for users inactive >5 days
8. Fix "Top Countries not available" in analytics
9. Commit updated CLAUDE.md files + primer.md to repo

---

## ⚠️ Hard-Won Lessons (never repeat these mistakes)

### Architecture
- `todaysTask` in campaign calendar comes from **pure JS rotation**, never DB writes
- Large animal filtering is **JS only** — Supabase array syntax unreliable
- `.neq('user_id', adminId)` **also excludes NULL rows** — always use `.or('user_id.is.null,user_id.neq.X')`
- Supabase clients must be initialized **inside** handler functions, never at module level
- `select('*')` on article lists causes pagination slowness — always select specific fields
- `summary` field is **long text** — never include in list queries, fetch lazily on expand

### Content Agent
- All platforms in "Generate All" must use the **same article_id** (forced after first generation)
- `growth_agent_memory` excludes only **approved** articles (not skipped) to avoid exhausting pool
- Exclude articles used **today** across all platforms (not just last 14 days)
- SKIP_LARGE_ANIMAL retry must ignore forced article_id on fallback
- LinkedIn: BANNED phrases include "game changer", "revolutionary", "excited to share"
- TikTok: scripts must be 80-100 words MAX (30-45 seconds), never start with "Did you know"
- Do NOT increase LinkedIn posting to 2-3x daily — algorithm penalizes frequency

### Analytics
- Article **views are unreliable signals** — social promotion bias
- Use **saves, synthesis runs, search demand** as primary quality signals
- Admin ID `90cb8294-b593-4144-a9f5-23ca52dd5e35` must be excluded from ALL analytics queries
- Session duration: cap at **1800 seconds** (30 min) before averaging
- DAU/MAU with only 15 registered users is statistically meaningless — WAU (231) is more useful
- Do NOT auto-trigger synthesis on every search — too expensive (Claude API cost)

### Supabase
- `topic_syntheses` and analytics tables need **service role** for writes
- `articles_blacklist` must be checked **before** inserting from PubMed pipeline
- `pubmed_id` has UNIQUE constraint — use upsert or check before insert

### GitHub Actions
- All workflows need `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`
- `weekly-digest.yml` calls `/api/digest/send` with Bearer DIGEST_SECRET header
- Analysis agent insights job only runs on **Friday** (cron `0 12 * * 5`) or manual dispatch
- Security agent runs **Thursday 19:00 UTC**

### Next.js / Vercel
- Vercel hobby plan timeout is **10 seconds** — add `export const maxDuration = 60` for Claude routes
- `unstable_cache` for journal/evidence filters — 3600s revalidate
- `getUniqueJournals()` and `getDistinctEvidenceLevels()` must NOT re-run on every page navigation
- All Claude Code prompts must start with: "Read CLAUDE.md, app/api/CLAUDE.md, supabase/CLAUDE.md, primer.md first. Then:"

### Growth Strategy
- LinkedIn works because of professional audience, not frequency — keep rotation as-is
- Viral spikes (+475% DAU) happen but don't stick — retention infrastructure needed first
- "Quantum physics" searches = noise from one user, not a content gap to fill
- Do NOT suggest "exit-intent capture" or "auto-trigger modals on every search"
- Do NOT suggest "increase LinkedIn to 2-3x daily"

---

## 📊 Current Metrics (April 3, 2026)
- Articles in DB: ~15,000+ enriched
- Registered users: ~15 confirmed
- DAU: 23 | WAU: 231 | MAU: 1,449
- DAU/MAU stickiness: 1.6% (target: >15%)
- Top traffic: LinkedIn (33) > Facebook (16) > Instagram (6) > TikTok (1)
- Zero-result search rate: 17.2% (regression — was near 0%)
- Avg session: 58s | Median: 11s (large gap = onboarding friction)
- Article saves: 0 | Synthesis runs: 0 (feature discovery problem)

---

## 🏗️ Platform at a Glance
- **Live:** vetree.app
- **Admin:** vetree.app/admin (Overview, Users, Reports, Pipeline, Analytics, Growth, Security)
- **GitHub:** roikris/vetree
- **Supabase project:** gnykidzijppxvrvvchxq
- **Email domain:** digest.vetree.app (Resend, verified, DKIM configured by Resend)
- **Journals:** 14 including Veterinary Ophthalmology (recently added)
- **Enrichment:** daily 02:00 UTC
- **Content posts:** daily reminder 03:00 UTC, admin generates + approves manually
- **Analysis:** aggregates daily 02:00 UTC, insights every Friday 12:00 UTC
- **Security scan:** every Thursday 19:00 UTC
- **Weekly digest:** every Friday 10:00 UTC
