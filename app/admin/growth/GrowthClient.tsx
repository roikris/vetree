'use client'

import { useState } from 'react'
import { ContentAgent } from './ContentAgent'
import { CampaignCalendar } from './CampaignCalendar'
import { SynthesisPosts } from './SynthesisPosts'
import { DigestDryRun } from './DigestDryRun'

// NOTE: Campaign uses growth_tasks table to track 90-day scheduled posts
// Each day's content is generated fresh by Content Agent (not pre-written)
// UTM tracking embedded automatically based on platform
// UTM Links tab removed — UTMs auto-embedded in posts

type GrowthClientProps = {
  // Kept for backwards compatibility
  initialStats?: any
  initialTodaysTasks?: any[]
  statsError?: string | null
  tasksError?: string | null
}

export function GrowthClient({}: GrowthClientProps) {
  const [activeTab, setActiveTab] = useState<'campaign' | 'agent' | 'synthesis' | 'digest'>('campaign')

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
          📅 Campaign
        </button>
        <button
          onClick={() => setActiveTab('agent')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'agent'
              ? 'text-[#3D7A5F] dark:text-[#4E9A78] border-b-2 border-[#3D7A5F] dark:border-[#4E9A78]'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          🤖 Content Agent
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
        <CampaignCalendar />
      ) : activeTab === 'agent' ? (
        <ContentAgent />
      ) : activeTab === 'synthesis' ? (
        <SynthesisPosts />
      ) : (
        <DigestDryRun />
      )}
    </div>
  )
}
