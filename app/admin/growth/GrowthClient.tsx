'use client'

import { useState } from 'react'
import { ContentAgent } from './ContentAgent'
import { UtmLinks } from './UtmLinks'

// NOTE: Daily tasks (growth_tasks table) deprecated - replaced by Content Agent
// The growth_tasks table still exists in the database but is no longer used
// Content Agent provides on-demand content generation instead of scheduled daily tasks

type GrowthClientProps = {
  // Kept for backwards compatibility, but no longer used
  initialStats?: any
  initialTodaysTasks?: any[]
  statsError?: string | null
  tasksError?: string | null
}

export function GrowthClient({}: GrowthClientProps) {
  const [activeTab, setActiveTab] = useState<'agent' | 'utm'>('agent')

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
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
          onClick={() => setActiveTab('utm')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'utm'
              ? 'text-[#3D7A5F] dark:text-[#4E9A78] border-b-2 border-[#3D7A5F] dark:border-[#4E9A78]'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          🔗 UTM Links
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'agent' ? (
        <ContentAgent />
      ) : (
        <UtmLinks />
      )}
    </div>
  )
}
