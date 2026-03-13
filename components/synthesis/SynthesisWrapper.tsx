'use client'

import { useState } from 'react'
import { SynthesisPanel } from './SynthesisPanel'
import { useFeatureFlags, isFeatureEnabled } from '@/lib/hooks/useFeatureFlags'

type SynthesisWrapperProps = {
  searchQuery: string
  children: React.ReactNode
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

      {/* Synthesis panel */}
      {showSynthesis && (
        <SynthesisPanel
          query={searchQuery}
          onClose={() => setShowSynthesis(false)}
        />
      )}

      {/* Original content */}
      {children}
    </>
  )
}
