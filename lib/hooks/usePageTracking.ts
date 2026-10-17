'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAdmin } from '@/lib/hooks/useAdmin'

// Generate or get existing session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = sessionStorage.getItem('analytics_session_id')
  if (!sessionId) {
    sessionId = newId()
    sessionStorage.setItem('analytics_session_id', sessionId)
  }
  return sessionId
}

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // RFC 4122 v4 from getRandomValues (older browsers without randomUUID)
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// One page_views row per view (analytics-001). The view's id is made here, before anything is sent, so the load
// and every duration update name the same row — the server never inserts a second row for a duration. Duration =
// visible seconds (paused while the tab is hidden), sent as a running total: on in-app navigation and when the tab
// is hidden (after the load request settles, so it usually lands second), and on pagehide (immediately — the page
// is going away). The server only ever raises the value, and holds a duration that beats its load until it lands.
export function usePageTracking() {
  const pathname = usePathname()
  const { isAdmin } = useAdmin()

  useEffect(() => {
    // Don't track admin users or browser automation
    if (isAdmin) return
    if (navigator.webdriver) return

    const sessionId = getSessionId()
    const viewId = newId()

    // Extract and persist UTM parameters
    const searchParams = new URLSearchParams(window.location.search)
    const utm_source = searchParams.get('utm_source') || null
    const utm_medium = searchParams.get('utm_medium') || null
    const utm_campaign = searchParams.get('utm_campaign') || null
    const utm_id = searchParams.get('utm_id') || null

    // Store in sessionStorage so UTMs persist across pages within same session
    if (utm_source) sessionStorage.setItem('utm_source', utm_source)
    if (utm_medium) sessionStorage.setItem('utm_medium', utm_medium)
    if (utm_campaign) sessionStorage.setItem('utm_campaign', utm_campaign)
    if (utm_id) sessionStorage.setItem('utm_id', utm_id)

    // Visible time: accumulated while the document is visible
    let visibleMs = 0
    let visibleSince: number | null = document.visibilityState === 'visible' ? Date.now() : null
    let lastSentSeconds = 0
    const visibleSeconds = () =>
      Math.floor((visibleMs + (visibleSince !== null ? Date.now() - visibleSince : 0)) / 1000)
    const pause = () => {
      if (visibleSince !== null) { visibleMs += Date.now() - visibleSince; visibleSince = null }
    }
    const resume = () => {
      if (visibleSince === null) visibleSince = Date.now()
    }

    // Track page view on load
    const loadDone: Promise<unknown> = (async () => {
      try {
        // Always send from sessionStorage (persists after leaving landing page)
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            view_id: viewId,
            path: pathname,
            referrer: document.referrer,
            session_id: sessionId,
            utm_source: sessionStorage.getItem('utm_source'),
            utm_medium: sessionStorage.getItem('utm_medium'),
            utm_campaign: sessionStorage.getItem('utm_campaign'),
            utm_id: sessionStorage.getItem('utm_id'),
          }),
        })
      } catch (error) {
        // Silently fail - don't disrupt user experience
        console.debug('[analytics] Failed to track page view:', error)
      }
    })()

    const sendDuration = (seconds: number) => {
      // Only a longer total is worth sending; under 1 second is not recorded
      if (seconds < 1 || seconds <= lastSentSeconds) return
      lastSentSeconds = seconds
      const data = JSON.stringify({ view_id: viewId, session_id: sessionId, duration_seconds: seconds })
      try {
        if (navigator.sendBeacon && navigator.sendBeacon('/api/analytics/track', data)) return
      } catch {
        // fall through to fetch
      }
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        keepalive: true,
      }).catch(error => console.debug('[analytics] Failed to track duration:', error))
    }
    // The page stays alive (in-app navigation, hidden tab): send after the load request settles
    const sendAfterLoad = () => {
      const seconds = visibleSeconds()
      loadDone.finally(() => sendDuration(seconds))
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { pause(); sendAfterLoad() } else resume()
    }
    // The page is going away (or into the back/forward cache): send now
    const onPageHide = () => { pause(); sendDuration(visibleSeconds()) }
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted && document.visibilityState === 'visible') resume() }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)

    // Track duration on page navigation
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
      pause()
      sendAfterLoad()
    }
  }, [pathname, isAdmin])
}
