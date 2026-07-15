# Vetree — Current State (primer.md)
*Last updated: 2026-07-15*
*Update this file after every Claude Code session*

---

## Active Focus
- Growth memory capture fixed (hook_line, stale closure, premature clear) — rematch should now improve as new posts accumulate memory rows
- LinkedIn metrics quality: no_article action, unmatched debt filter
- Migration policy rule 14 in CLAUDE.md: all schema changes via migration file + db push
- All PRs through #19 merged to main; smoke suite green

---

## Recently Completed (2026-07 session)
- **PR #7** chore/sonnet-migration-and-pr-smoke: all AI calls → Sonnet 4.6, Upstash noop for Preview, qa-triage fixes (skipped bucket, last-attempt verdict, file:line in Slack)
- **PR #8** fix/analytics-server-client: service role key for analytics reads + MAU sanity guard
- **PR #10** fix/security-scan-findings: CHECK 19 regex fix + self-exclusion; xlsx 0.18.5 → 0.20.3 (SheetJS CDN tarball)
- **PR #11** fix/reset-password-pkce: exchangeCodeForSession + PASSWORD_RECOVERY handler
- **PR #12** fix/small-fixes-queue: useAdmin .maybeSingle(), /auth/signin → /login, publication_date revert
- **PR #13** fix/smoke-unsave-race: Promise.all(waitForResponse, click) for unsave
- **PR #14** fix/reset-redirect-target: redirectTo hardcoded fallback; PASSWORD_RECOVERY safety net in useAuth
- **PR #15** fix/reset-page-session-priority: signOut({ scope: 'local' }) before exchangeCodeForSession
- **PR #16** fix/search-logging: SearchControls logging useEffect; data_gap signal in signals route
- **PR #17** chore/docs-current-state: all .md files updated to verified current state; api-CLAUDE.md and supabase-CLAUDE.md renamed to canonical paths; migration 042 for linkedin match_method
- **PR #18** chore/retire-fix-malformed-titles: deleted fix-malformed-titles workflow + script; 0 rows ever matched, 3 runs all failed, never fixed anything
- **PR #19** fix/growth-memory-capture: 3 memory-capture bugs fixed (hook_line missing, premature clearSavedPost, onPaste stale closure); unified "Copy & mark posted" button; LinkedIn tab inline URL input; no_article action + unmatched debt filter in metrics; migration 043 (no_article constraint); CLAUDE.md rule 14 (migration policy + drift reconciliation)

---

## Open Bugs / Known Issues
- None known

## Recently Resolved
- **2026-07-14:** `linkedin_post_metrics.match_method` DB constraint was missing `'ai'`. Migration 042 applied → `activity_id | slug | date | ai | haiku | manual`.
- **2026-07-15:** 3 compounding bugs caused growth_agent_memory to have near-zero coverage (no hook_line, premature clearSavedPost, stale closure on paste). Fixed in PR #19. Also added `no_article` to constraint via migration 043.

---

## Platform at a Glance
- **Live:** vetree.app
- **Admin:** vetree.app/admin (Overview, Users, Reports, Pipeline, Analytics, Growth, Security)
- **GitHub:** roikris/vetree
- **Supabase project:** gnykidzijppxvrvvchxq
- **Digest email:** digest@digest.vetree.app (Resend)
- **Auth email:** auth@digest.vetree.app (Resend custom SMTP)
- **Enrichment:** daily 07:00 UTC (after PubMed sync at 06:00 UTC)
- **Analysis:** aggregates + signals daily 02:00 UTC; insights Friday 12:00 UTC
- **Security scan:** Thursday 19:00 UTC
- **Weekly digest:** Friday 10:00 UTC
- **Content post reminder:** daily 03:00 UTC

---

## Hard-Won Lessons (never repeat these mistakes)

### Analytics
- **Any metric hitting zero = broken sensor until proven otherwise.** Investigate the logger before concluding users stopped using the feature.
- `analytics_daily_snapshot` is pre-filtered (admin + TEST_USER_ID excluded). Raw table queries are NOT.
- Article views are unreliable signals (social promotion bias). Use saves, searches, synthesis runs.
- Never hand-roll the excluded-users filter; always use `excludedUsersOrFilter()` from `lib/analytics-excluded-ids.ts`.

### Save Flow
- `toggleSave` must use plain `fetch('/api/save-article')`, not a server action. Server actions go through the sequential router action queue; slow auth refreshes can delay a save by 15+ seconds.
- Any navigation after unsave must wait for the API response: `Promise.all([waitForResponse, click()])`.

### Password Reset
- `signOut({ scope: 'local' })` before `exchangeCodeForSession` — global scope revokes all devices.
- `NEXT_PUBLIC_SITE_URL` is not set in Vercel; always use `|| 'https://vetree.app'` fallback for redirectTo.
- Test password reset in incognito only.

### Architecture
- `todaysTask` in campaign calendar comes from pure JS rotation, never DB writes.
- Large animal filtering is JS only — Supabase array syntax unreliable.
- `.neq('user_id', adminId)` also excludes NULL rows — always use `.or('user_id.is.null,user_id.neq.X')`.
- Supabase clients must be initialized inside handler functions, never at module level.
- `select('*')` on article lists causes slowness — always select specific fields.
- `summary` field is long text — never include in list queries, fetch lazily on expand.
- Schema is the source of truth for column names. Verified: `publication_date` (not `published_date`), `saved_at` (not `created_at`) in saved_articles.

### GitHub Actions
- All workflows need `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`.
- `analysis-agent.yml` has two jobs: `aggregate` (daily) and `insights` (Friday only).
- Weekly digest is Friday 10:00 UTC (insights is Friday 12:00 UTC — different schedule).

### Next.js / Vercel
- `vercel env pull` can be stale — use Vercel dashboard as source of truth for env vars.
- `unstable_cache` for journal/evidence filters — 3600s revalidate.
- All Claude Code prompts must start with: "Read CLAUDE.md, app/api/CLAUDE.md, supabase/CLAUDE.md first. Then:"
