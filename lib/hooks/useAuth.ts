'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

// Singleton Supabase client — one GoTrue instance for the entire browser session.
const supabase = createClient()

// Deduplicate concurrent getUser() calls across all useAuth() instances.
// Without this, N components each calling getUser() → N concurrent network calls
// to Supabase auth endpoint, causing a refresh storm that fills the Next.js
// router action queue ahead of user-triggered saves.
let _userPromise: Promise<User | null> | null = null

function getSharedUser() {
  if (!_userPromise) {
    _userPromise = supabase.auth.getUser()
      .then(({ data: { user } }) => user)
      .catch(() => null)
  }
  return _userPromise
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
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
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
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
      // A fresh SIGNED_IN can mean a Server Component on the current page
      // already rendered without this session (e.g. right after an OAuth code
      // exchange finishes client-side). Refresh so anything server-rendered
      // here picks up the cookie that was just written, no manual reload.
      if (event === 'SIGNED_IN') {
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
