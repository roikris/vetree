'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

export function useAdmin() {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAdminStatus() {
      console.log('[useAdmin] Starting check - authLoading:', authLoading, 'user:', user?.id)

      if (authLoading) {
        console.log('[useAdmin] Auth still loading, waiting...')
        return
      }

      if (!user) {
        console.log('[useAdmin] No user, setting isAdmin to false')
        setIsAdmin(false)
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()
        console.log('[useAdmin] Fetching role for user:', user.id)
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()

        console.log('[useAdmin] Query result - data:', data, 'error:', error)

        if (error) {
          console.error('[useAdmin] Error checking admin status:', error)
          setIsAdmin(false)
        } else {
          const adminStatus = data?.role === 'admin'
          console.log('[useAdmin] Role:', data?.role, 'Is Admin:', adminStatus)
          setIsAdmin(adminStatus)
        }
      } catch (error) {
        console.error('[useAdmin] Exception checking admin status:', error)
        setIsAdmin(false)
      } finally {
        setLoading(false)
        console.log('[useAdmin] Check complete')
      }
    }

    checkAdminStatus()
  }, [user, authLoading])

  console.log('[useAdmin] Returning - isAdmin:', isAdmin, 'loading:', loading || authLoading)
  return { isAdmin, loading: loading || authLoading }
}
