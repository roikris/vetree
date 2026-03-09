'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

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

  useEffect(() => {
    const sessionId = getSessionId()
    const startTime = Date.now()

    // Track page view on load
    const trackPageView = async () => {
      try {
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: pathname,
            referrer: document.referrer,
            session_id: sessionId
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
  }, [pathname])
}
