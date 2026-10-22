// When useAuth should router.refresh() after an auth event — free of Supabase and Next so tests can drive it
// (tests/unit/signInRefresh.test.ts).
//
// Why it exists: auth-js emits SIGNED_IN not only on a real sign-in but every time it recovers a stored session — on
// every page start and every time the tab becomes visible again (GoTrueClient _recoverAndRefresh). useAuth used to
// refresh on every SIGNED_IN, once per mounted useAuth() (one per stream row), so a signed-in home load re-rendered the
// whole page ~46 times on the server (measured in production 2026-10-22, analytics-001), all billed Vercel CPU.
//
// Rule: refresh once per event, and only when the signed-in user is now different from the one the server rendered
// for. The server render used this request's session cookie, so before any event the known state is "the cookie's
// user" when a session cookie was present at page load, "nobody" when it wasn't.

// The session cookie @supabase/ssr writes: sb-<project ref>-auth-token, or .0, .1, … when split (same rule as
// proxy.ts). Never the -code-verifier cookie.
const SESSION_COOKIE = /(?:^|;\s*)sb-[a-z0-9]+-auth-token(?:\.0)?=/

export function hasSessionCookie(cookieHeader: string): boolean {
  return SESSION_COOKIE.test(cookieHeader)
}

// Returns the event handler: call it once per auth event (not once per component) with the session's user id.
// It calls refresh() when that event should re-render the page.
export function createSignInRefresher(opts: {
  hadSessionAtLoad: boolean
  refresh: () => void
}): (event: string, userId: string | null) => void {
  // undefined = no event yet: the user is whoever the load-time cookie belonged to (or nobody)
  let known: string | null | undefined

  return (event, userId) => {
    const prev = known
    // Every event carries the session's user (INITIAL_SESSION, TOKEN_REFRESHED, SIGNED_OUT … included): it is the
    // latest word on who is signed in, so the next SIGNED_IN is compared with it.
    known = userId
    if (event !== 'SIGNED_IN') return
    const changed = prev === undefined ? !opts.hadSessionAtLoad : prev !== userId
    if (changed) opts.refresh()
  }
}
