'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

export function useAdmin() {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    if (checkedRef.current) return
    checkedRef.current = true

    const supabase = createClient()
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        setIsAdmin(!error && data?.role === 'admin')
        setLoading(false)
      })
  }, [user?.id, authLoading])

  return { isAdmin, loading: loading || authLoading }
}
