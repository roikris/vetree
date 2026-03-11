import { getPipelineStats, getArticleHealthDiagnostics } from '@/app/actions/admin'
import { PipelineClient } from './PipelineClient'
import { PipelineStats } from './PipelineStats'
import { ArticleHealth } from './ArticleHealth'
import { FailedArticles } from './FailedArticles'

export default async function AdminPipelinePage() {
  const { stats, error } = await getPipelineStats()
  const diagnostics = await getArticleHealthDiagnostics()

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

      {/* Article Health Diagnostics */}
      <ArticleHealth diagnostics={diagnostics} />

      {/* Failed Articles Table */}
      <FailedArticles />

      {/* Stats Cards */}
      <PipelineStats initialStats={stats} initialError={error} />

      {/* Pipeline Controls */}
      <PipelineClient pendingCount={stats?.pendingEnrichment || 0} />
    </div>
  )
}
