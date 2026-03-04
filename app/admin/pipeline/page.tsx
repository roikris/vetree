import { getPipelineStats } from '@/app/actions/admin'
import { PipelineClient } from './PipelineClient'
import { DownloadFailedCSV } from './DownloadFailedCSV'
import { EnrichFailedButton } from './EnrichFailedButton'

export default async function AdminPipelinePage() {
  const { stats, error } = await getPipelineStats()

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          Pipeline Management
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Monitor and manage the article enrichment pipeline
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200 text-sm">
            Error loading pipeline stats: {error}
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Failed Enrichment</span>
            <span className="text-2xl">❌</span>
          </div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-500 mb-1">
            {stats?.failedEnrichment || 0}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Articles with 3+ failed attempts
          </p>
          {stats?.failedEnrichment && stats.failedEnrichment > 0 && (
            <div className="flex gap-2">
              <DownloadFailedCSV />
              <EnrichFailedButton />
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Last Sync</span>
            <span className="text-2xl">🔄</span>
          </div>
          <div className="text-lg font-semibold text-[#3D7A5F] dark:text-[#4E9A78] mb-1">
            {stats?.lastSyncDate
              ? new Date(stats.lastSyncDate).toLocaleDateString('en-US', {
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
      </div>

      {/* Pipeline Controls */}
      <PipelineClient pendingCount={stats?.pendingEnrichment || 0} />
    </div>
  )
}
