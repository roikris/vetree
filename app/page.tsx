import { parseSearchParams } from '@/lib/utils/searchParams'
import { searchArticles, getUniqueJournals, getDistinctEvidenceLevels } from '@/lib/queries/articles'
import { SearchControls } from '@/components/search/SearchControls'
import { ResultsCount } from '@/components/ui/ResultsCount'
import { ArticleList } from '@/components/articles/ArticleList'
import { Pagination } from '@/components/ui/Pagination'

// Force dynamic rendering to ensure searchParams are always fresh
export const dynamic = 'force-dynamic'

type HomeProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams
  const filters = parseSearchParams(params)

  // Fetch filtered articles
  const { data: articles, count, error } = await searchArticles(filters, 20)

  // Fetch unique journals and evidence levels for filters
  const journals = await getUniqueJournals()
  const evidenceLevels = await getDistinctEvidenceLevels()

  const totalPages = Math.ceil((count || 0) / 20)

  const hasActiveFilters = filters.search || filters.labels.length > 0 ||
    filters.evidence.length > 0 || filters.journals.length > 0 ||
    filters.quickFilter !== 'all'

  return (
    <SearchControls
      initialFilters={filters}
      availableJournals={journals}
      availableEvidenceLevels={evidenceLevels}
    >
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
          <p className="text-red-800 dark:text-red-200">
            Error loading articles: {error.message}
          </p>
          <p className="text-sm text-red-600 dark:text-red-300 mt-2">
            Make sure you have run the SQL migration in your Supabase dashboard.
            See SETUP.md for instructions.
          </p>
        </div>
      )}

      {!error && count === 0 && !hasActiveFilters && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-2">
            No articles yet
          </h2>
          <p className="text-blue-700 dark:text-blue-300 mb-4">
            Get started by importing articles from a CSV file:
          </p>
          <code className="block bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 p-3 rounded font-mono text-sm">
            npm run import-articles scripts/sample-articles.csv
          </code>
        </div>
      )}

      {!error && (count !== null && count > 0 || hasActiveFilters) && (
        <>
          <ResultsCount
            total={count || 0}
            showing={articles?.length || 0}
            filters={filters}
          />

          <ArticleList articles={articles || []} />

          <Pagination
            currentPage={filters.page}
            totalPages={totalPages}
            filters={filters}
          />
        </>
      )}
    </SearchControls>
  )
}
