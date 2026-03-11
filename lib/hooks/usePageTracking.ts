'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAdmin } from '@/lib/hooks/useAdmin'

// Generate or get existing session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = sessionStorage.getItem('analytics_session_id')
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem('analytics_session_id', sessionId)
  }
  return sessionId
}

export function usePageTracking() {
  const pathname = usePathname()
  const { isAdmin } = useAdmin()

  useEffect(() => {
    // Don't track admin users
    if (isAdmin) return

    const sessionId = getSessionId()
    const startTime = Date.now()

    // Extract and persist UTM parameters
    const searchParams = new URLSearchParams(window.location.search)
    const utm_source = searchParams.get('utm_source') || null
    const utm_medium = searchParams.get('utm_medium') || null
    const utm_campaign = searchParams.get('utm_campaign') || null

    // Store in sessionStorage so UTMs persist across pages within same session
    if (utm_source) sessionStorage.setItem('utm_source', utm_source)
    if (utm_medium) sessionStorage.setItem('utm_medium', utm_medium)
    if (utm_campaign) sessionStorage.setItem('utm_campaign', utm_campaign)

    // Track page view on load
    const trackPageView = async () => {
      try {
        // Always send from sessionStorage (persists after leaving landing page)
        const tracked_utm_source = sessionStorage.getItem('utm_source')
        const tracked_utm_medium = sessionStorage.getItem('utm_medium')
        const tracked_utm_campaign = sessionStorage.getItem('utm_campaign')

        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: pathname,
            referrer: document.referrer,
            session_id: sessionId,
            utm_source: tracked_utm_source,
            utm_medium: tracked_utm_medium,
            utm_campaign: tracked_utm_campaign
          })
        })
      } catch (error) {
        // Silently fail - don't disrupt user experience
        console.debug('[analytics] Failed to track page view:', error)
      }
    }

    // Track duration on page leave
    const trackDuration = async () => {
      const duration = Math.floor((Date.now() - startTime) / 1000) // seconds

      // Only track if user spent at least 1 second
      if (duration < 1) return

      try {
        // Use sendBeacon for reliability on page unload
        const data = JSON.stringify({
          path: pathname,
          session_id: sessionId,
          duration_seconds: duration
        })

        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/analytics/track', data)
        } else {
          // Fallback for older browsers
          await fetch('/api/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true
          })
        }
      } catch (error) {
        console.debug('[analytics] Failed to track duration:', error)
      }
    }

    trackPageView()

    // Track duration on page navigation or unload
    return () => {
      trackDuration()
    }
  }, [pathname, isAdmin])
}
