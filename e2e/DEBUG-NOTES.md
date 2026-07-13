# Test 5 Debug Notes — auth round-trip smoke test

## Symptom
Test 5 ("auth round-trip: intent=save saves article, appears in library, unsave removes it") has never passed.
The 3-way OR assertion (`save-toast | already-saved-toast | first-save-shelf`) times out at 15s.

## What Was Fixed (committed, working)
1. **ArticleAppBar aria-label** (commit d781874): Save button had no aria-label; test uses
   `[aria-label="Remove from library"]` / `[aria-label="Save to library"]` for cleanup/unsave.
2. **`already-saved-toast` testId** (commit 0114ccc): Already-saved branch was rendering as generic
   `save-toast`, making 3-way assertion unreliable on re-runs.
3. **`useSavedArticles` loading deadlock** (commit 0114ccc): `setLoading(false)` not guaranteed if
   `getUserSavedArticleIds` threw — fixed with try/finally.
4. **Silent error path** (commit 0114ccc): Server-side error/duplicate key silently swallowed — now
   shows toast.
5. **`.catch()` on toggleSave** (commit 8cf582b): No `.catch()` on `.then()` chain; if `saveArticle`
   threw, no toast appeared.
6. **Diagnostic console.logs** (commit 8cf582b, current deployed): Added `[SIH]` logs at every
   decision point in SaveIntentHandler so traces show exactly what happened.

## Dead Theories
- `revalidatePath('/library')` causing router refresh that kills toast → **ruled out**
- `useAuth` loading deadlock → **ruled out** (authLoading reaches false in traces)
- `useSavedArticles` stuck on saveLoading → **ruled out** (both reach false at t=40312)
- `navigator.webdriver` guard blocking save → **not a problem** (only skips analytics)
- Server-side `getUser()` slowness → **ruled out as primary cause** (see root cause below)
- Upstash rate limiting → **ruled out** (no rate limit code in saveArticle or middleware)
- Self-fetch to vetree.app inside action → **ruled out** (no such call in saveArticle)

## DB Check (confirmed)
Queried `saved_articles` for smoke user `ce9bde59-2d18-4fd9-bcf5-57d925450d2b` via PostgREST:
Result `[]` — save **never committed** to DB. The article was not saved at all.

## Console Timeline (diagnostic trace, intent page)
```
t=40215  Playwright assertion starts (15s clock starts here)
t=40251  [SIH] effect: authLoading=true saveLoading=true handled=false → early return
t=40312  [SIH] effect: authLoading=false saveLoading=false handled=false
t=40312  [SIH] intent param: save  user: roi.kris+smoketest@gmail.com
t=40313  [SIH] user found, isSaved=false savedIds.size=0
t=40313  [SIH] calling toggleSave, isFirstSave=true
t=40404  CONSOLE[error]: 406 — user_roles (useAdmin, empty user_id — see "Live Bugs" below)
t=40516  CONSOLE[error]: 404 — /auth/signin?_rsc= (RSC prefetch — see "Live Bugs" below)
[SILENCE for ~15 seconds]
t=55215  Assertion timeout fires
t=55249  Finally-block navigation starts (page.goto('/article/...'))
t=56705  [SIH] effect fires on fresh page load
```
**No `[SIH] toggleSave result:` and no `[SIH] toggleSave threw:`**
The Promise from `toggleSave(articleId)` never settled within the 15s window.

## Network Table (full picture, intent page + finally)
```
19:42:09.178  POST  /article/pubmed-42420216?intent=save  200  629ms   ← getUserSavedArticleIds (SIH, fired while URL still had ?intent=save)
19:42:13.773  POST  /article/pubmed-42420216              200  718ms   ← getUserSavedArticleIds (queue item 2)
19:42:14.512  POST  /article/pubmed-42420216              200  672ms   ← getUserSavedArticleIds (queue item 3)
19:42:25.702  POST  /article/pubmed-42420216              -1   send:-1 ← saveArticle — NEVER SENT, cancelled by navigation
```

Key: the saveArticle POST has `send: -1` — the browser **never transmitted the packet**.
It was created in the browser at t≈55249 (exactly when the finally-block navigation fired) and
immediately cancelled. The fetch was held in a queue for ~15 seconds.

Also visible: 12 concurrent client-side `GET /auth/v1/user` at 19:42:09:
- 3 fast (85ms each)
- 9 slow (4329ms, 4415ms, 4497ms, 4621ms, 4708ms, 4795ms...)
These slow Supabase auth calls are client-side, not server-side.

## Root Cause (confirmed from Next.js source)

Every server action call goes through `next/dist/client/app-call-server.js`:
```js
async function callServer(actionId, actionArgs) {
  return new Promise((resolve, reject) => {
    startTransition(() => {
      dispatchAppRouterAction({
        type: ACTION_SERVER_ACTION,
        actionId, actionArgs, resolve, reject
      })
    })
  })
}
```

`dispatchAppRouterAction` feeds into the **sequential router action queue** in
`next/dist/client/components/app-router-instance.js`. Only ONE action runs at a time.
Subsequent actions queue behind the current one.

**Sequence:**
1. Auth resolves (fast 85ms client-side call) → SIH's `useSavedArticles` effect fires → `getUserSavedArticleIds` queued → runs → completes at 19:42:09.807
2. SIH effect fires (t=40312/40313): `toggleSave` → `saveArticle` enqueued in router queue
3. Meanwhile: auth state fires AGAIN (slow 4329–4795ms calls completing at 19:42:13–14) → `useSavedArticles` effects re-trigger → more `getUserSavedArticleIds` calls enqueued IN FRONT OF saveArticle (or behind — order TBD)
4. Queue drains in order: the two 19:42:13 and 19:42:14 POSTs execute before saveArticle
5. By t=55249 the queue finally reaches saveArticle — but the test's 15s assertion just timed out and `page.goto` fires, cancelling the pending fetch (send:-1)

The **12 concurrent slow Supabase auth calls** are the trigger: they cause `onAuthStateChange` to fire
multiple times, each triggering `useSavedArticles` → `getUserSavedArticleIds` → another item in the
sequential action queue. `saveArticle` sits at the back of this queue.

## Fix Direction
Do NOT change `getUser()` to `getSession()` — weakens auth, flagged by security scan.

**Correct fix:** Bypass the Next.js router action queue for `toggleSave`. Use a plain `fetch()` to a
dedicated API route (`/api/save-article`) instead of calling a server action. Regular `fetch()` calls
are dispatched immediately, not through the action queue. This is the same pattern used for analytics
and other non-navigation side effects.

Alternative (narrower): Move `saveArticle`/`unsaveArticle` to API routes only; keep `getUserSavedArticleIds`
as a server action (its queue position doesn't matter — it's just loading state).

## Live Bugs (tomorrow's fixes, not tonight's blocker)

### Bug A — 406 on user_roles for all non-admin article page visitors
**Where:** `useAdmin` hook calls `supabase.from('user_roles').select('role').eq('user_id', userId).single()`
when `userId` is null or the row doesn't exist. `.single()` throws 406 when zero rows returned.
**Fix:** Add `.maybeSingle()` instead of `.single()`, or guard with `if (!user)`.
**Impact:** Console error on every article page for every logged-in non-admin user.

### Bug B — 404 on /auth/signin RSC prefetch
**Where:** Some component on the article page links to `/auth/signin` (probably ArticleAppBar's "Sign in"
link when user is null). This route doesn't exist (our auth is at `/login` and `/signup`).
**Fix:** Change the "Sign in" link from `/auth/signin` to `/login`.
**File:** `components/articles/ArticleAppBar.tsx` line 120 — `<Link href="/auth/signin">`
**Impact:** Next.js prefetches linked pages; 404 appears in console on every article page load.

## Files To Edit (for main fix)
- `app/api/save-article/route.ts` — new API route (replaces server action for save/unsave)
- `lib/hooks/useSavedArticles.ts` — `toggleSave` uses `fetch('/api/save-article', ...)` directly
- `app/actions/saved-articles.ts` — keep `getUserSavedArticleIds` and `getSavedArticles` as actions

## Post-Fix Checklist
1. Run test twice consecutively:
   - Run 1: already-saved-toast branch (leftover state from prior crashed run cleaned)
   - Run 2: fresh save → toast or first-save-shelf → library shows it → unsave clears it
2. Remove `[SIH]` diagnostic console.logs from SaveIntentHandler
3. Fix Bug A (useAdmin .single() → .maybeSingle())
4. Fix Bug B (ArticleAppBar /auth/signin → /login)
5. Commit clean version
