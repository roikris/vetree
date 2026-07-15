# E2E Smoke Suite — Debug Notes

## RESOLVED POSTMORTEMS

### 1. Action-queue save bug (fixed PR #3 / fix/bypass-action-queue)
`toggleSave` was a Next.js server action. The router's sequential action queue let concurrent
`getUserSavedArticleIds` calls — triggered by multiple `onAuthStateChange` events from slow Supabase
auth refreshes — queue ahead of `saveArticle`. The save POST was created in the browser but never
transmitted (`send: -1`). Fix: replaced the server action with a plain `fetch()` to `/api/save-article`.
Plain fetch bypasses the action queue and dispatches immediately. Both unsave clicks in the smoke test
are also wrapped in `Promise.all([waitForResponse('/api/save-article'), click()])` to confirm the API
commit before navigation (PR #13 / fix/smoke-unsave-race).

### 2. Analytics zeros + TEST_USER_ID (fixed PR #8 / fix/analytics-server-client)
`analytics.ts` was importing `@/lib/supabase/client` (anon key) in a server context. RLS returned
empty 200s instead of errors, silently producing zeros. Separately, `excludedUsersOrFilter()` used
flat OR logic for 2+ IDs — a row with user_id=A satisfied `neq.B`, so excluded users were not
actually excluded. Fixes: service role key in analytics reads; `and(neq.A,neq.B)` semantics in
`lib/analytics-excluded-ids.ts`; UUID validation for TEST_USER_ID; MAU==0 sanity guard in aggregate
route (aborts with 500 rather than writing zero snapshot).

### 3. Upstash preview 500s (fixed PR #7 / chore/sonnet-migration-and-pr-smoke)
Routes importing `ratelimitStrict` etc. threw on Vercel Preview because Upstash env vars are not set
in preview deployments. Fix: `lib/ratelimit.ts` `makeRatelimit()` returns a noop limiter when env
vars are absent. In non-production this is silent fail-open. In production it logs loud (Sentry +
console.error) so missing Upstash is never silent.

### 4. Unsave race (fixed PR #13 / fix/smoke-unsave-race)
Smoke test navigated away immediately after clicking unsave, cancelling the in-flight request.
Fix: both unsave clicks (main flow + finally-block cleanup) wrapped in
`Promise.all([page.waitForResponse(r => r.url().includes('/api/save-article') && r.ok()), unsaveBtn.click()])`.
This waits for the API to confirm the delete before `page.goto()` fires.

### 5. Password reset PKCE + session priority (fixed PR #11, #14, #15)
Three compounding problems:
- `redirectTo` in `app/actions/profile.ts` was `"undefined/reset-password"` because
  `NEXT_PUBLIC_SITE_URL` is not set in Vercel (fixed with `|| 'https://vetree.app'` fallback).
- The reset page wasn't calling `exchangeCodeForSession(code)` — the PKCE code in the URL was never
  consumed, so Supabase never fired `PASSWORD_RECOVERY` and the password form never appeared.
- When a user was already logged in, `exchangeCodeForSession` fired SIGNED_IN instead of
  PASSWORD_RECOVERY. Fix: `getSession()` → if session exists, `signOut({ scope: 'local' })` first,
  then exchange. Scope must be `'local'` — global scope would revoke all sessions across all devices.
- Safety net added in `useAuth.ts`: if `PASSWORD_RECOVERY` fires on any page other than
  `/reset-password`, `router.replace('/reset-password')` is called immediately.

### 6. Search logging drop (fixed PR #16 / fix/search-logging)
The Almanac feed redesign (commit `e84070b`, July 3, 2026) replaced `SearchBar` with `SearchControls`
but did not port the `/api/analytics/search` logging call. `search_logs` flatlined on June 30.
Fix: `useEffect` in `SearchControls` watches `[initialFilters.search, resultsCount]` — fires after
navigation completes so `results_count` reflects the actual server-rendered count. A `data_gap`
signal (severity 0.9) was also added to `signals/route.ts` to alert via Slack if `total_searches`
ever hits zero again.

---

## PARKED

Nothing currently parked. All known smoke test and analytics issues resolved as of 2026-07-14.

### RETIRED: fix-malformed-titles (2026-07-15)
`.github/workflows/fix-malformed-titles.yml` and `scripts/fix-malformed-titles.js` deleted.
- Script detected `title LIKE '{"_":%'` (PubMed JSON italic encoding for species names)
- 0 rows ever matched; current enrichment pipeline never produces this pattern
- 3 runs total (2026-06-23, 2026-07-01, 2026-07-15) — all failures (Node 20 lacks native WebSocket; script didn't install `ws`)
- Rows fixed = 0; workflow never successfully ran once

If a new flaky test or unexplained zero appears, apply the standing rule:
**Any metric hitting zero is a broken sensor until proven otherwise.** Investigate the logging
pipeline before concluding a feature is unused.
