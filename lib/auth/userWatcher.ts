// The logic behind useAuth's watchSignedInUser, free of Supabase so tests can drive it (tests/unit/userWatcher.test.ts).

// The auth events that can change who is signed in. PASSWORD_RECOVERY is verifyOtp({ type: 'recovery' })'s sign-in:
// auth-js emits it INSTEAD of SIGNED_IN (GoTrueClient verifyOtp), and the session stays even if the new password is
// then rejected.
export const IDENTITY_EVENTS = new Set(['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'PASSWORD_RECOVERY'])

type Identified = { id: string }

// Calls onUser with the initial user, then again each time it becomes a DIFFERENT user (or none). isCurrent() turns
// false the moment a newer identity's event arrives (synchronously, before its deferred delivery runs) or on stop, so
// async work started for the previous user can't act; a delivery superseded while queued never runs.
export function createUserWatcher<U extends Identified>(opts: {
  initial: Promise<U | null>
  subscribe: (listener: (event: string, user: U | null) => void) => () => void
  onUser: (user: U | null, isCurrent: () => boolean) => void
  defer?: (fn: () => void) => void
}): () => void {
  // Off the auth callback by default: Supabase queries started inside it can deadlock on the auth lock
  const defer = opts.defer ?? (fn => { setTimeout(fn, 0) })
  let seen: string | null | undefined   // undefined = nothing seen yet
  let generation = 0
  let eventArrived = false
  let stopped = false

  // Records a change of identity and invalidates the previous one at once; 0 = no change
  const change = (user: U | null): number => {
    const id = user?.id ?? null
    if (stopped || id === seen) return 0
    seen = id
    return ++generation
  }
  const deliver = (user: U | null, mine: number) => {
    if (stopped || mine !== generation) return
    opts.onUser(user, () => !stopped && mine === generation)
  }

  // An event that arrived first is newer than this (possibly pre-sign-in) answer
  opts.initial.then(user => {
    if (eventArrived) return
    const mine = change(user)
    if (mine) deliver(user, mine)
  })
  const unsubscribe = opts.subscribe((event, user) => {
    if (!IDENTITY_EVENTS.has(event)) return
    eventArrived = true
    const mine = change(user)
    if (mine) defer(() => deliver(user, mine))
  })
  return () => { stopped = true; unsubscribe() }
}
