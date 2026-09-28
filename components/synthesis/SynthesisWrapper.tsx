'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { SynthesisPanel } from './SynthesisPanel'
import { useFeatureFlags, isFeatureEnabled } from '@/lib/hooks/useFeatureFlags'
import { normalizeQuery } from '@/lib/utils/normalizeQuery'

type SynthesisWrapperProps = {
  searchQuery: string
  children: React.ReactNode
  isLoggedIn?: boolean
  view?: string
}

export function SynthesisWrapper({ searchQuery, children, isLoggedIn, view }: SynthesisWrapperProps) {
  const [showSynthesis, setShowSynthesis] = useState(false)
  const { flags, loading } = useFeatureFlags()
  const searchParams = useSearchParams()
  const synthesisPanelRef = useRef<HTMLDivElement>(null)
  const autoTriggeredRef = useRef(false)
  const engagedFiredRef = useRef(false)

  const synthesisEnabled = isFeatureEnabled(flags, 'topic_synthesis')
  const canSynthesize = synthesisEnabled && searchQuery.trim().length >= 3
  // Automated browsers (Playwright smoke, CI) never auto-run: they would spend a Claude call and
  // count as experiment runs. From 2026-06-20 to 2026-09-28 they did — 139 of September's 304
  // /synthesis/run events fell inside CI smoke windows.
  const isAutomated = typeof navigator !== 'undefined' && navigator.webdriver === true
  const [dismissed, setDismissed] = useState(false)

  // Auto-run synthesis on mount for any meaningful query (auto-run experiment, restarted
  // 2026-09-28 — see KICKOFF_DATE in app/admin/campaign/page.tsx)
  useEffect(() => {
    if (loading) return
    if (autoTriggeredRef.current) return
    if (!canSynthesize || isAutomated) return

    autoTriggeredRef.current = true
    setShowSynthesis(true)
  }, [loading, canSynthesize, isAutomated])

  // Auto-trigger from URL params (e.g. from Content Roadmap "Create Synthesis" button)
  useEffect(() => {
    if (loading) return
    const synthesize = searchParams.get('synthesize')
    if (synthesize === 'true' && searchQuery && synthesisEnabled && !isAutomated) {
      autoTriggeredRef.current = true
      setTimeout(() => {
        setShowSynthesis(true)
        // Drop only the trigger. Keep every other param: a search with no quickFilter now
        // means ALL species (lib/utils/species.ts), so rebuilding the URL from the query alone
        // would silently widen an explicit small-animal search.
        const params = new URLSearchParams(window.location.search)
        params.delete('synthesize')
        const qs = params.toString()
        window.history.replaceState(null, '', qs ? `/?${qs}` : '/')
        setTimeout(() => {
          synthesisPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }, 500)
    }
  }, [searchParams, searchQuery, synthesisEnabled, loading, isAutomated])

  // synthesis_engaged: a displayed synthesis whose run the server recorded in this mount (see
  // SynthesisPanel onDisplayed) scrolled into view — never the loading skeleton, an error,
  // "insufficient studies", or a sessionStorage replay. Once per query per browser session; the
  // session marker is written only after the event is confirmed stored, and a failed send is
  // retried on the next time the panel scrolls into view.
  const [displayed, setDisplayed] = useState(false)
  const onDisplayed = useCallback(() => setDisplayed(true), [])
  useEffect(() => {
    if (!showSynthesis || !displayed || !synthesisPanelRef.current || engagedFiredRef.current) return
    if (isAutomated) return
    const engagedKey = `vetree_synthesis_engaged_${normalizeQuery(searchQuery)}`

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || engagedFiredRef.current) return
        try { if (sessionStorage.getItem(engagedKey)) { engagedFiredRef.current = true; return } } catch { /* unavailable */ }
        engagedFiredRef.current = true   // also the in-flight guard
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'synthesis_engaged', query: searchQuery })
        })
          .then(res => {
            if (!res.ok) throw new Error(`engaged ${res.status}`)
            try { sessionStorage.setItem(engagedKey, '1') } catch { /* unavailable: once per mount */ }
          })
          .catch(() => { engagedFiredRef.current = false })
      },
      { threshold: 0.3 }
    )

    observer.observe(synthesisPanelRef.current)
    return () => observer.disconnect()
  }, [showSynthesis, displayed, searchQuery, isAutomated])

  return (
    <>
      {/* Reopen after the reader closes the auto-run panel (and the only way in for automated
          browsers, which never auto-run). Hidden until then so it never flashes before auto-run. */}
      {canSynthesize && !showSynthesis && !loading && (dismissed || isAutomated) && (
        <div style={{ maxWidth: view === 'list' ? 844 : 704, margin: '0 auto', padding: '4px 32px 0' }}>
          <button
            type="button"
            data-testid="synthesis-open"
            onClick={() => setShowSynthesis(true)}
            title="An AI summary of what the top studies on this topic agree and disagree on, with citations"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '9px 16px', borderRadius: 999, cursor: 'pointer',
              background: 'rgba(var(--al-acct, 95,140,51), .08)',
              border: '1px solid rgba(var(--al-acct, 95,140,51), .35)',
              color: 'var(--al-accent)',
              font: '600 13.5px/1 var(--font-instrument, sans-serif)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h7M17 15l2 2 4-4" />
            </svg>
            Synthesize the evidence
            <span className="hidden md:inline" style={{ font: '400 12.5px/1 var(--font-instrument, sans-serif)', color: 'var(--al-mut4)' }}>
              · AI summary of the top studies
            </span>
          </button>
        </div>
      )}

      {/* Synthesis panel — constrained to same width as ArticleList */}
      {showSynthesis && (
        <div ref={synthesisPanelRef} style={{ maxWidth: view === 'list' ? 844 : 704, margin: '0 auto', padding: '0 32px' }}>
          <SynthesisPanel
            query={searchQuery}
            onClose={() => { setShowSynthesis(false); setDismissed(true); setDisplayed(false) }}
            onDisplayed={onDisplayed}
            isLoggedIn={isLoggedIn}
          />
        </div>
      )}

      {/* Original content */}
      {children}
    </>
  )
}
