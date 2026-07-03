import { parseSearchParams } from '@/lib/utils/searchParams'
import { searchArticles, getUniqueJournals, getDistinctEvidenceLevels } from '@/lib/queries/articles'
import { SearchControls } from '@/components/search/SearchControls'
import { ResultsCount } from '@/components/ui/ResultsCount'
import { ArticleFeedWrapper } from '@/components/articles/ArticleFeedWrapper'
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner'
import { TrendingArticles } from '@/components/articles/TrendingArticles'
import { PersonalizedFeed } from '@/components/articles/PersonalizedFeed'
import { HeroSection } from '@/components/home/HeroSection'
import { LandingPage } from '@/components/home/LandingPage'
import { getTrendingArticles } from '@/app/actions/trending'
import { getPersonalizedArticles } from '@/app/actions/personalized-feed'
import { createClient } from '@/lib/supabase/server'
import { SynthesisWrapper } from '@/components/synthesis/SynthesisWrapper'

// Force dynamic rendering to ensure searchParams are always fresh
export const dynamic = 'force-dynamic'

type HomeProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams
  const filters = parseSearchParams(params)

  // Check if user is logged in
  // Use getSession() for UI gating (reads local cookie, no network round-trip — reliable even during token refresh)
  // Use getUser() where needed for security-sensitive checks
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = !!(session || user)

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

  // Show full marketing landing page for logged-out guests on first page with no filters
  const isLanding = !isLoggedIn && filters.page === 1 && !filters.search &&
    filters.labels.length === 0 && filters.evidence.length === 0 &&
    filters.journals.length === 0 && filters.quickFilter === 'all' &&
    !params.browse

  if (isLanding) {
    // Fetch most recent article for the hero card mock
    const { data: exampleArticle } = await supabase
      .from('articles')
      .select('title, clinical_bottom_line, source_journal, labels, publication_date')
      .eq('needs_enrichment', false)
      .not('clinical_bottom_line', 'is', null)
      .order('publication_date', { ascending: false })
      .limit(1)
      .single()
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <LandingPage exampleArticle={exampleArticle} />
      </>
    )
  }

  // Fetch most recent article for legacy hero (shown on first page when no search/labels but browse=1 or other filters)
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

  // Stats (legacy hero)
  const stats = !isLoggedIn
    ? await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://vetree.app'}/api/stats/public`, {
        next: { revalidate: 3600 }
      }).then(r => r.json()).catch(() => ({ confirmed_users: 0, articles_count: 8000 }))
    : { confirmed_users: 0, articles_count: 0 }

  // Count articles published in the last 7 days (for stream header)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { count: newThisWeek } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('needs_enrichment', false)
    .not('clinical_bottom_line', 'is', null)
    .gte('publication_date', sevenDaysAgo)

  // Fetch filtered articles
  const { data: articles, count, error, searchTier } = await searchArticles(filters, 20)

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
            {error.message}
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
          {/* Constrain disclaimer + results count to feed width */}
          <div style={{ maxWidth: filters.view === 'list' ? 844 : 704, margin: '0 auto', padding: '0 32px' }}>
            <DisclaimerBanner />

            <TrendingArticles articles={trendingArticles} />

            <PersonalizedFeed articles={personalizedArticles} />

            <ResultsCount
              total={count || 0}
              showing={deduplicatedArticles.length}
              filters={filters}
            />

            {/* Fuzzy search hint */}
            {searchTier === 'fuzzy' && filters.search && (
              <p style={{ margin: '0 0 16px', fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 13, fontStyle: 'italic', color: 'var(--al-mut4)' }}>
                Showing results for approximate match of &ldquo;{filters.search}&rdquo;
              </p>
            )}
          </div>

          {/* Synthesis wrapper - shows synthesis button and panel when search query exists */}
          <SynthesisWrapper searchQuery={filters.search} isLoggedIn={isLoggedIn}>
            <ArticleFeedWrapper
              articles={deduplicatedArticles}
              searchQuery={filters.search || undefined}
              currentPage={filters.page}
              totalPages={totalPages}
              totalCount={count || 0}
              newThisWeek={newThisWeek ?? undefined}
              filters={filters}
            />
          </SynthesisWrapper>
        </div>
      )}
      </SearchControls>
    </>
  )
}
