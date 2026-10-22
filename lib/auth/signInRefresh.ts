// When useAuth should router.refresh() after an auth event — free of Supabase and Next so tests can drive it
// (tests/unit/signInRefresh.test.ts).
//
// Why it exists: auth-js emits SIGNED_IN not only on a real sign-in but every time it recovers a stored session — on
// every page start and every time the tab becomes visible again (GoTrueClient _recoverAndRefresh). useAuth used to
// refresh on every SIGNED_IN, once per mounted useAuth() (one per stream row), so a signed-in home load re-rendered the
// whole page ~46 times on the server (measured in production 2026-10-22, analytics-001), all billed Vercel CPU.
//
// Rule: refresh once per event, and only when an event names a signed-in user different from the one the page was
// last rendered for. The server render used this request's session cookie, so at first that user is the one in the
// cookie read at page load (sessionUserIdFromCookies). INITIAL_SESSION counts like SIGNED_IN: when the listener
// registers after a sign-in already finished (a client-side code exchange during initialize), INITIAL_SESSION is the
// first event that names the new user.

// The value the server rendered for: a user id, null = signed out, undefined = a cookie we could not read (then the
// first event with a user refreshes — one extra render beats a page showing the wrong account).
export type RenderedUser = string | null | undefined

// The user id in the @supabase/ssr session cookie `storageKey` (sb-<project ref>-auth-token): the whole cookie, or its
// chunks .0, .1, … joined in order; value "base64-" + base64url(JSON session), or the raw JSON (older format).
// null = no session cookie; undefined = a cookie that could not be read.
export function sessionUserIdFromCookies(cookieHeader: string, storageKey: string): RenderedUser {
  const jar = new Map<string, string>()
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const name = part.slice(0, eq).trim()
    try { jar.set(name, decodeURIComponent(part.slice(eq + 1).trim())) } catch { jar.set(name, part.slice(eq + 1).trim()) }
  }
  let value = jar.get(storageKey)
  if (value === undefined) {
    const chunks: string[] = []
    for (let i = 0; jar.has(`${storageKey}.${i}`); i++) chunks.push(jar.get(`${storageKey}.${i}`)!)
    if (chunks.length === 0) return null
    value = chunks.join('')
  }
  try {
    const json = value.startsWith('base64-') ? fromBase64Url(value.slice('base64-'.length)) : value
    const session = JSON.parse(json)
    const id = session?.user?.id
    return typeof id === 'string' && id ? id : undefined
  } catch {
    return undefined
  }
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// Returns the event handler: call it once per auth event (not once per component) with the session's user id.
// It calls refresh() when that event should re-render the page.
export function createSignInRefresher(opts: {
  renderedAtLoad: RenderedUser
  refresh: () => void
}): (event: string, userId: string | null) => void {
  let rendered = opts.renderedAtLoad

  return (event, userId) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      // A null INITIAL_SESSION (signed out, or a cookie that turned out invalid) is not a sign-in: no refresh, as before
      if (userId === null) { rendered = null; return }
      if (userId !== rendered) {
        rendered = userId
        opts.refresh()
      }
      return
    }
    // Sign-out paths navigate or refresh themselves (unchanged); afterwards the page is for nobody. PASSWORD_RECOVERY
    // moves to /reset-password (useAuth). TOKEN_REFRESHED / USER_UPDATED keep the same user.
    if (event === 'SIGNED_OUT') rendered = null
    else if (event === 'PASSWORD_RECOVERY') rendered = userId
  }
}
