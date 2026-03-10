import { parseSearchParams } from '@/lib/utils/searchParams'
import { searchArticles, getUniqueJournals, getDistinctEvidenceLevels } from '@/lib/queries/articles'
import { SearchControls } from '@/components/search/SearchControls'
import { ResultsCount } from '@/components/ui/ResultsCount'
import { ArticleList } from '@/components/articles/ArticleList'
import { Pagination } from '@/components/ui/Pagination'
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner'
import { TrendingArticles } from '@/components/articles/TrendingArticles'
import { PersonalizedFeed } from '@/components/articles/PersonalizedFeed'
import { HeroSection } from '@/components/home/HeroSection'
import { getTrendingArticles } from '@/app/actions/trending'
import { getPersonalizedArticles } from '@/app/actions/personalized-feed'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering to ensure searchParams are always fresh
export const dynamic = 'force-dynamic'

type HomeProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams
  const filters = parseSearchParams(params)

  // Check if user is logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = !!user

  // Fetch public stats for hero section
  const statsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://vetree.app'}/api/stats/public`, {
    next: { revalidate: 3600 }
  })
  const stats = await statsResponse.json().catch(() => ({ confirmed_users: 0, articles_count: 8000 }))

  // Fetch most recent article for hero example (only if not logged in and on first page)
  let exampleArticle = null
  if (!isLoggedIn && filters.page === 1 && !filters.search && filters.labels.length === 0) {
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('needs_enrichment', false)
      .not('clinical_bottom_line', 'is', null)
      .order('publication_date', { ascending: false })
      .limit(1)
      .single()
    exampleArticle = data
  }

  // JSON-LD structured data for site-level SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Vetree",
    "description": "Evidence-based veterinary research, distilled.",
    "url": "https://vetree.app",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://vetree.app/?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }

  // Fetch filtered articles
  const { data: articles, count, error } = await searchArticles(filters, 20)

  // Fetch unique journals and evidence levels for filters
  const journals = await getUniqueJournals()
  const evidenceLevels = await getDistinctEvidenceLevels()

  // Fetch trending articles (only show on first page with no filters)
  const showTrending = filters.page === 1 && !filters.search &&
    filters.labels.length === 0 && filters.evidence.length === 0 &&
    filters.journals.length === 0 && filters.quickFilter === 'all'

  const { articles: trendingArticles } = showTrending
    ? await getTrendingArticles()
    : { articles: [] }

  // Fetch personalized articles (only show on first page with no filters)
  const { articles: personalizedArticles, hasFollowedTags } = showTrending
    ? await getPersonalizedArticles()
    : { articles: [], hasFollowedTags: false }

  // Deduplicate main feed articles to avoid showing same articles in personalized feed
  const personalizedIds = new Set(personalizedArticles.map(a => a.id))
  const deduplicatedArticles = articles?.filter(a => !personalizedIds.has(a.id)) || []

  const totalPages = Math.ceil((count || 0) / 20)

  const hasActiveFilters = filters.search || filters.labels.length > 0 ||
    filters.evidence.length > 0 || filters.journals.length > 0 ||
    filters.quickFilter !== 'all'

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero Section - only for non-logged-in users on first page */}
      {!isLoggedIn && filters.page === 1 && !filters.search && filters.labels.length === 0 && (
        <HeroSection exampleArticle={exampleArticle} stats={stats} />
      )}

      <SearchControls
        initialFilters={filters}
        availableJournals={journals}
        availableEvidenceLevels={evidenceLevels}
        resultsCount={count || 0}
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
        <div id="articles">
          <DisclaimerBanner />

          <TrendingArticles articles={trendingArticles} />

          <PersonalizedFeed articles={personalizedArticles} />

          <ResultsCount
            total={count || 0}
            showing={deduplicatedArticles.length}
            filters={filters}
          />

          <ArticleList articles={deduplicatedArticles} />

          <Pagination
            currentPage={filters.page}
            totalPages={totalPages}
            filters={filters}
          />
        </div>
      )}
      </SearchControls>
    </>
  )
}
