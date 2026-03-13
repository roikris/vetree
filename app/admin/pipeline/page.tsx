import { getPipelineStats, getArticleHealthDiagnostics } from '@/app/actions/admin'
import { PipelineClient } from './PipelineClient'
import { PipelineStats } from './PipelineStats'
import { ArticleHealth } from './ArticleHealth'
import { FailedArticles } from './FailedArticles'
import { IncompleteEnrichment } from './IncompleteEnrichment'
import { ScheduledJobs } from './ScheduledJobs'
import Link from 'next/link'

export default async function AdminPipelinePage() {
  const { stats, error } = await getPipelineStats()
  const diagnostics = await getArticleHealthDiagnostics()

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
            Pipeline Management
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Monitor and manage the article enrichment pipeline
          </p>
        </div>
        <Link
          href="/admin/pipeline/diagnostics"
          className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          View Detailed Diagnostics
        </Link>
      </div>

      {/* Incomplete Enrichment Alert */}
      <IncompleteEnrichment />

      {/* Article Health Diagnostics */}
      <ArticleHealth diagnostics={diagnostics} />

      {/* Failed Articles Table */}
      <FailedArticles />

      {/* Scheduled Jobs */}
      <div className="mt-8">
        <ScheduledJobs />
      </div>

      {/* Stats Cards */}
      <div className="mt-8">
        <PipelineStats initialStats={stats} initialError={error} />
      </div>

      {/* Pipeline Controls */}
      <PipelineClient pendingCount={stats?.pendingEnrichment || 0} />
    </div>
  )
}
