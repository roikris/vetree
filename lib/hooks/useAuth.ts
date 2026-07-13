'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    // Shared across all useAuth() instances — only one network call to Supabase.
    getSharedUser().then(user => {
      setUser(user)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Invalidate cache on real auth changes so next getUser() is fresh.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        _userPromise = null
      }
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
