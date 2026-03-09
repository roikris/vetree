'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function usePageTracking() {
  const pathname = usePathname()

  useEffect(() => {
    // Track page view
    const trackPageView = async () => {
      try {
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: pathname,
            referrer: document.referrer
          })
        })
      } catch (error) {
        // Silently fail - don't disrupt user experience
        console.debug('[analytics] Failed to track page view:', error)
      }
    }

    trackPageView()
  }, [pathname])
}
