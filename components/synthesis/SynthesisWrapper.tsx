'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { SynthesisPanel } from './SynthesisPanel'
import { useFeatureFlags, isFeatureEnabled } from '@/lib/hooks/useFeatureFlags'

type SynthesisWrapperProps = {
  searchQuery: string
  children: React.ReactNode
  isLoggedIn?: boolean
}

export function SynthesisWrapper({ searchQuery, children, isLoggedIn }: SynthesisWrapperProps) {
  const [showSynthesis, setShowSynthesis] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const { flags, loading } = useFeatureFlags()
  const searchParams = useSearchParams()
  const synthesisPanelRef = useRef<HTMLDivElement>(null)
  const autoTriggeredRef = useRef(false)

  // Check if feature is enabled
  const synthesisEnabled = isFeatureEnabled(flags, 'topic_synthesis')

  // Only show synthesis button if query has 2+ words AND feature is enabled
  const shouldShowButton = searchQuery.trim().split(/\s+/).length >= 2 && synthesisEnabled

  // Track search count and show tip for first 3 searches
  useEffect(() => {
    if (shouldShowButton && !showSynthesis) {
      const searchCount = parseInt(localStorage.getItem('vetree_search_count') || '0', 10)

      if (searchCount < 3) {
        // Increment counter
        localStorage.setItem('vetree_search_count', String(searchCount + 1))

        // Show tip after a short delay
        setTimeout(() => setShowTip(true), 800)

        // Hide tip after 8 seconds
        setTimeout(() => setShowTip(false), 8800)
      }
    }
  }, [shouldShowButton, showSynthesis])

  // Auto-trigger synthesis from URL params (e.g. from Content Roadmap "Create Synthesis" button)
  useEffect(() => {
    if (loading) return                // wait for feature flags to finish loading
    if (autoTriggeredRef.current) return

    const synthesize = searchParams.get('synthesize')

    if (synthesize === 'true' && searchQuery && synthesisEnabled) {
      autoTriggeredRef.current = true

      setTimeout(() => {
        setShowSynthesis(true)
        // Clean URL AFTER showing synthesis so replaceState doesn't race with the param read
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

  return (
    <>
      {/* Helpful tip - shown only for first 3 searches */}
      {showTip && shouldShowButton && !showSynthesis && !loading && (
        <div className="mb-4 flex justify-center animate-fade-in">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2.5 shadow-sm max-w-md">
            <p className="text-sm text-blue-900 dark:text-blue-100 text-center font-medium flex items-center justify-center gap-2">
              <span className="text-lg">💡</span>
              <span>Tip: Click <strong>Synthesize</strong> for an AI summary of these studies</span>
            </p>
          </div>
        </div>
      )}

      {/* Synthesis trigger button - MORE PROMINENT */}
      {shouldShowButton && !showSynthesis && !loading && (
        <div className="mb-6 flex justify-center">
          <button
            onClick={() => setShowSynthesis(true)}
            className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3 hover:scale-105 active:scale-100 ring-2 ring-blue-300 dark:ring-blue-700 hover:ring-4"
            title="Get AI synthesis of the top research on this topic"
          >
            <span className="text-2xl animate-pulse">🔬</span>
            <span>Synthesize Results</span>
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      )}

      {/* Synthesis panel */}
      {showSynthesis && (
        <div ref={synthesisPanelRef}>
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
