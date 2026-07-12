'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { SynthesisPanel } from './SynthesisPanel'
import { useFeatureFlags, isFeatureEnabled } from '@/lib/hooks/useFeatureFlags'

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
  const shouldAutoRun = searchQuery.trim().length >= 2 && synthesisEnabled

  // Auto-run synthesis on mount for any meaningful query (90-day experiment)
  useEffect(() => {
    if (loading) return
    if (autoTriggeredRef.current) return
    if (!shouldAutoRun) return

    autoTriggeredRef.current = true
    setShowSynthesis(true)
  }, [loading, shouldAutoRun])

  // Auto-trigger from URL params (e.g. from Content Roadmap "Create Synthesis" button)
  useEffect(() => {
    if (loading) return
    const synthesize = searchParams.get('synthesize')
    if (synthesize === 'true' && searchQuery && synthesisEnabled) {
      autoTriggeredRef.current = true
      setTimeout(() => {
        setShowSynthesis(true)
        window.history.replaceState(
          null,
          '',
          searchQuery ? `/?search=${encodeURIComponent(searchQuery)}` : '/'
        )
        setTimeout(() => {
          synthesisPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }, 500)
    }
  }, [searchParams, searchQuery, synthesisEnabled, loading])

  // Fire synthesis_engaged event when panel scrolls into view (distinguishes exposure from reading)
  useEffect(() => {
    if (!showSynthesis || !synthesisPanelRef.current || engagedFiredRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !engagedFiredRef.current) {
          if (typeof navigator !== 'undefined' && navigator.webdriver) return
          engagedFiredRef.current = true
          fetch('/api/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'synthesis_engaged', query: searchQuery })
          }).catch(() => {})
        }
      },
      { threshold: 0.3 }
    )

    observer.observe(synthesisPanelRef.current)
    return () => observer.disconnect()
  }, [showSynthesis, searchQuery])

  return (
    <>
      {/* Synthesis panel — constrained to same width as ArticleList */}
      {showSynthesis && (
        <div ref={synthesisPanelRef} style={{ maxWidth: view === 'list' ? 844 : 704, margin: '0 auto', padding: '0 32px' }}>
          <SynthesisPanel
            query={searchQuery}
            onClose={() => setShowSynthesis(false)}
            isLoggedIn={isLoggedIn}
          />
        </div>
      )}

      {/* Original content */}
      {children}
    </>
  )
}
