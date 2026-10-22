'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { createUserWatcher } from '@/lib/auth/userWatcher'
import { createSignInRefresher, sessionUserIdFromCookies } from '@/lib/auth/signInRefresh'

// Read before anything async can run (a client-side code exchange writes the cookie only after a network round trip):
// the user this page's server render was for — the session cookie's user (lib/auth/signInRefresh.ts). The cookie name
// is @supabase/ssr's default storage key, sb-<project ref>-auth-token.
const _renderedAtLoad = typeof document === 'undefined' ? undefined : sessionUserIdFromCookies(
  document.cookie,
  `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`,
)

// Singleton Supabase client — one GoTrue instance for the entire browser session.
const supabase = createClient()

// Deduplicate concurrent getUser() calls across all useAuth() instances.
// Without this, N components each calling getUser() → N concurrent network calls
// to Supabase auth endpoint, causing a refresh storm that fills the Next.js
// router action queue ahead of user-triggered saves.
let _userPromise: Promise<User | null> | null = null

// Exported for components that only need "who is signed in" (ConsentGate, DigestConsentPrompt): one getUser() per page
// instead of one per component — 3 → 1 on every signed-in page load (measured 2026-10-20, analytics-001).
export function getSharedUser() {
  watchAuthEvents()
  if (!_userPromise) {
    _userPromise = supabase.auth.getUser()
      .then(({ data: { user } }) => user)
      .catch(() => null)
  }
  return _userPromise
}

// The cache must follow sign-in / sign-out even on a page where no useAuth() instance is mounted (getSharedUser's
// other callers), so one module-level listener replaces it — the same rule as the hook's own listener below.
let _watching = false
// Mounted useAuth() instances' router.refresh — the one refresh per real sign-in calls any one of them
// (lib/auth/signInRefresh.ts). One is enough: refresh() re-renders the current route as a whole.
const _routerRefreshers = new Set<() => void>()
function watchAuthEvents() {
  if (_watching) return
  _watching = true
  const onSignInEvent = createSignInRefresher({
    renderedAtLoad: _renderedAtLoad,
    // A fresh sign-in can mean a Server Component on the current page rendered without this session (e.g. a code
    // exchange that finished client-side). Refresh so it picks up the cookie that was just written, no manual reload.
    refresh: () => { for (const r of _routerRefreshers) { r(); return } },
  })
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY') {
      _userPromise = Promise.resolve(session?.user ?? null)
    }
    onSignInEvent(event, session?.user?.id ?? null)
  })
}

// For components mounted once in the root layout (ConsentGate, DigestConsentPrompt): a check run only on mount misses
// a different user signing in or out without a page load (the reset link's in-page verifyOtp, another tab). Calls
// onUser with the user now, then again each time it becomes a DIFFERENT user (not on token refreshes or profile
// updates); isCurrent() turns false as soon as a newer identity's event arrives or on unmount. Logic and tests:
// lib/auth/userWatcher.ts. Returns the unsubscribe.
export function watchSignedInUser(onUser: (user: User | null, isCurrent: () => boolean) => void): () => void {
  return createUserWatcher<User>({
    initial: getSharedUser(),
    subscribe: listener => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => listener(event, session?.user ?? null))
      return () => subscription.unsubscribe()
    },
    onUser,
  })
}

function clearServiceWorkerCaches() {
  try {
    if (typeof caches !== 'undefined') {
      caches.keys()
        .then(names => Promise.all(names.map(n => caches.delete(n))))
        .catch(() => { /* best-effort */ })
    }
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_CACHES' })
  } catch { /* best-effort */ }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const refresh = () => router.refresh()
    _routerRefreshers.add(refresh)
    // Shared across all useAuth() instances — only one network call to Supabase.
    getSharedUser().then(user => {
      setUser(user)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Replace the cache with the answer we already have, synchronously, at
      // the moment of the event — not null-then-wait-for-the-next-caller-to-
      // refetch. A null cache has a real gap: a getSharedUser() call between
      // invalidation and the next network round-trip could still be served a
      // promise that was already in flight from BEFORE this event, i.e. the
      // pre-login "no user" answer. Setting an already-resolved promise here
      // closes that gap outright.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY') {
        _userPromise = Promise.resolve(session?.user ?? null)
      }
      // Safety net: wherever the PKCE code is exchanged, always land on the
      // reset form. Handles any page that exchanges ?code= before /reset-password
      // is visited (e.g. homepage silently consuming the code).
      if (event === 'PASSWORD_RECOVERY' && pathname !== '/reset-password') {
        router.replace('/reset-password')
        return
      }
      setUser(session?.user ?? null)
      setLoading(false)
      // No router.refresh() here: the module-level listener refreshes once per real sign-in (watchAuthEvents). Here it
      // ran once per useAuth() on every SIGNED_IN, which auth-js also emits on each page start and tab refocus.
      // Account transition: drop the service worker's caches. Since public/sw.js v2 they only
      // hold public static assets, but the old worker stored private responses, and a sign-out
      // on a shared device must not leave anything behind. Every client sign-out path emits
      // SIGNED_OUT, so this is the one place to do it.
      if (event === 'SIGNED_OUT') {
        clearServiceWorkerCaches()
      }
    })

    return () => {
      subscription.unsubscribe()
      _routerRefreshers.delete(refresh)
    }
  }, [])

  return { user, loading }
}
