'use client'

import { useEffect, useState } from 'react'
import { getPipelineStats } from '@/app/actions/admin'
import { DownloadFailedCSV } from './DownloadFailedCSV'
import { EnrichFailedButton } from './EnrichFailedButton'

type Stats = {
  pendingEnrichment: number
  failedEnrichment: number
  lastSyncDate: string | null
}

type PipelineStatsProps = {
  initialStats: Stats | undefined
  initialError: string | null
}

export function PipelineStats({ initialStats, initialError }: PipelineStatsProps) {
  const [stats, setStats] = useState<Stats | undefined>(initialStats)
  const [error, setError] = useState<string | null>(initialError)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchStats = async () => {
    setIsRefreshing(true)
    try {
      const result = await getPipelineStats()
      if (result.error) {
        setError(result.error)
      } else {
        setStats(result.stats)
        setError(null)
      }
    } catch (err) {
      setError('Failed to fetch stats')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Pending Enrichment Card */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Pending Enrichment</span>
          <span className="text-2xl">⏳</span>
        </div>
        <div className="text-3xl font-bold text-amber-600 dark:text-amber-500 mb-1">
          {stats?.pendingEnrichment || 0}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Articles waiting to be enriched
        </p>
      </div>

      {/* Failed Enrichment Card */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Failed Enrichment</span>
            <button
              onClick={fetchStats}
              disabled={isRefreshing}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
              title="Refresh count"
            >
              <svg
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
          <span className="text-2xl">❌</span>
        </div>
        <div className="text-3xl font-bold text-red-600 dark:text-red-500 mb-1">
          {stats?.failedEnrichment || 0}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Articles still needing attention
        </p>
        {stats?.failedEnrichment && stats.failedEnrichment > 0 && (
          <div className="flex gap-2">
            <DownloadFailedCSV />
            <EnrichFailedButton />
          </div>
        )}
      </div>

      {/* Last Sync Card */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Last Sync</span>
          <span className="text-2xl">🔄</span>
        </div>
        <div className="text-lg font-semibold text-[#3D7A5F] dark:text-[#4E9A78] mb-1">
          {stats?.lastSyncDate
            ? new Date(stats.lastSyncDate).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'Never'}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Most recent article added
        </p>
      </div>

      {error && (
        <div className="col-span-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">
            Error loading pipeline stats: {error}
          </p>
        </div>
      )}
    </div>
  )
}
