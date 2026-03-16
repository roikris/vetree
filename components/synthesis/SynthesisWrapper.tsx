'use client'

import { useState, lazy, Suspense } from 'react'
import { useFeatureFlags, isFeatureEnabled } from '@/lib/hooks/useFeatureFlags'

// Lazy load the heavy SynthesisPanel component
const SynthesisPanel = lazy(() => import('./SynthesisPanel').then(mod => ({ default: mod.SynthesisPanel })))

type SynthesisWrapperProps = {
  searchQuery: string
  children: React.ReactNode
}

function SynthesisPanelSkeleton() {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl">🔬</div>
        <div className="flex-1">
          <div className="h-6 bg-blue-200 dark:bg-blue-800 rounded w-48 mb-2"></div>
          <div className="h-4 bg-blue-100 dark:bg-blue-900 rounded w-64"></div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-blue-100 dark:bg-blue-900 rounded w-full"></div>
        <div className="h-4 bg-blue-100 dark:bg-blue-900 rounded w-5/6"></div>
        <div className="h-4 bg-blue-100 dark:bg-blue-900 rounded w-4/6"></div>
      </div>
    </div>
  )
}

export function SynthesisWrapper({ searchQuery, children }: SynthesisWrapperProps) {
  const [showSynthesis, setShowSynthesis] = useState(false)
  const { flags, loading } = useFeatureFlags()

  // Check if feature is enabled
  const synthesisEnabled = isFeatureEnabled(flags, 'topic_synthesis')

  // Only show synthesis button if query has 2+ words AND feature is enabled
  const shouldShowButton = searchQuery.trim().split(/\s+/).length >= 2 && synthesisEnabled

  return (
    <>
      {/* Synthesis trigger button */}
      {shouldShowButton && !showSynthesis && !loading && (
        <div className="mb-6 flex justify-center">
          <button
            onClick={() => setShowSynthesis(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            title="Get AI synthesis of the top research on this topic"
          >
            <span className="text-xl">🔬</span>
            <span>Synthesize Results</span>
          </button>
        </div>
      )}

      {/* Synthesis panel with lazy loading */}
      {showSynthesis && (
        <Suspense fallback={<SynthesisPanelSkeleton />}>
          <SynthesisPanel
            query={searchQuery}
            onClose={() => setShowSynthesis(false)}
          />
        </Suspense>
      )}

      {/* Original content */}
      {children}
    </>
  )
}
