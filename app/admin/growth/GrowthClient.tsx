'use client'

import { useState } from 'react'
import { DailyPosts } from './DailyPosts'
import { SynthesisPosts } from './SynthesisPosts'
import { DigestDryRun } from './DigestDryRun'
// Daily posts (growth-002): every day one article goes to every platform — DailyPosts.tsx. Posts are generated fresh
// by the Content Agent route (not pre-written); UTM tracking is embedded automatically per platform. The standalone
// Content Agent tab and the 90-day rotation calendar were removed (unused; Roi 2026-10-13).
// UTM Links tab removed — UTMs auto-embedded in posts

type GrowthClientProps = {
  // Kept for backwards compatibility
  initialStats?: any
  initialTodaysTasks?: any[]
  statsError?: string | null
  tasksError?: string | null
}

export function GrowthClient({}: GrowthClientProps) {
  const [activeTab, setActiveTab] = useState<'campaign' | 'synthesis' | 'digest'>('campaign')

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('campaign')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'campaign'
              ? 'text-[#3D7A5F] dark:text-[#4E9A78] border-b-2 border-[#3D7A5F] dark:border-[#4E9A78]'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          📅 Daily Posts
        </button>
        <button
          onClick={() => setActiveTab('synthesis')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'synthesis'
              ? 'text-[#3D7A5F] dark:text-[#4E9A78] border-b-2 border-[#3D7A5F] dark:border-[#4E9A78]'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          🔬 Synthesis Posts
        </button>
        <button
          onClick={() => setActiveTab('digest')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'digest'
              ? 'text-[#3D7A5F] dark:text-[#4E9A78] border-b-2 border-[#3D7A5F] dark:border-[#4E9A78]'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          📬 Digest Preview
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'campaign' ? (
        <DailyPosts />
      ) : activeTab === 'synthesis' ? (
        <SynthesisPosts />
      ) : (
        <DigestDryRun />
      )}
    </div>
  )
}
