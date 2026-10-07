import type { Metadata } from 'next'
import { parseSearchParams } from '@/lib/utils/searchParams'
import { DEFAULT_QUICK_FILTER, matchesQuickFilter } from '@/lib/utils/species'
import { searchArticles, getUniqueJournals, getDistinctEvidenceLevels } from '@/lib/queries/articles'
import { SearchControls } from '@/components/search/SearchControls'
import { ResultsCount } from '@/components/ui/ResultsCount'
import { ArticleFeedWrapper } from '@/components/articles/ArticleFeedWrapper'
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner'
import { TrendingArticles } from '@/components/articles/TrendingArticles'
import { PersonalizedFeed } from '@/components/articles/PersonalizedFeed'
import { LandingPage } from '@/components/home/LandingPage'
import { PersonalizeCard } from '@/components/home/PersonalizeCard'
import { getTrendingArticles } from '@/app/actions/trending'
import { getPersonalizedArticles } from '@/app/actions/personalized-feed'
import { createClient } from '@/lib/supabase/server'
import { SynthesisWrapper } from '@/components/synthesis/SynthesisWrapper'
import { Suspense } from 'react'
import { SearchResults } from '@/components/search/SearchResults'
import { SproutLoader } from '@/components/search/SproutLoader'
import { searchKeyFor } from '@/lib/search/progressive'
import { getVisibleArticleCount, formatArticleCount } from '@/lib/queries/publicStats'

// Force dynamic rendering to ensure searchParams are always fresh
export const dynamic = 'force-dynamic'

type HomeProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Search results are not pages to index (Google crawled the old JSON-LD SearchAction template
// "/?search={search_term_string}" literally and reported it as a soft 404, Search Console 2026-10-07).
// The SearchAction is gone too — Google retired the sitelinks search box in 2024.
export async function generateMetadata({ searchParams }: HomeProps): Promise<Metadata> {
  const { search } = await searchParams
  return search !== undefined ? { robots: { index: false, follow: true } } : {}
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
    "url": "https://vetree.app"
  }

  // Show full marketing landing page for logged-out guests on first page with no filters
  const isLanding = !isLoggedIn && filters.page === 1 && !filters.search &&
    filters.labels.length === 0 && filters.evidence.length === 0 &&
    filters.journals.length === 0 && filters.quickFilter === DEFAULT_QUICK_FILTER &&
    !params.browse

  if (isLanding) {
    // Fetch most recent article for the hero card mock
    // Newest article that fits the species default (the landing page only renders under
    // the default scope). Filtered in JS per the project's large-animal rule.
    const { data: recentForLanding } = await supabase
      .from('articles')
      .select('id, title, clinical_bottom_line, source_journal, labels, publication_date, strength_of_evidence')
      .eq('needs_enrichment', false)
      .not('clinical_bottom_line', 'is', null)
      .order('publication_date', { ascending: false })
      .limit(20)
    const exampleArticle =
      (recentForLanding ?? []).find(a => matchesQuickFilter(a.labels, DEFAULT_QUICK_FILTER)) ?? null
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <LandingPage exampleArticle={exampleArticle} articleCountLabel={formatArticleCount(await getVisibleArticleCount())} />
      </>
    )
  }

  // Searches skip the feed-header-only query below, so the search's own streamed results (and
  // its "Searching…" loader) start sooner. (The guests' second hero on the Stream was removed
  // 2026-10-03 — the landing page is the one pitch; "Browse articles" goes straight to the feed.)
  const isSearchRequest = !!filters.search.trim()

  // Count articles published in the last 7 days (for stream header)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { count: newThisWeek } = isSearchRequest ? { count: null } : await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('needs_enrichment', false)
    .not('clinical_bottom_line', 'is', null)
    .gte('publication_date', sevenDaysAgo)

  // A search renders progressively in its own streamed subtree (components/search/SearchResults);
  // only the feed (no search) is fetched here.
  const isSearch = !!filters.search.trim()
  const { data: articles, count, error, searchTier } = isSearch
    ? { data: [] as any[], count: 0, error: null as { message: string } | null, searchTier: undefined }
    : await searchArticles(filters, 20)

  // Fetch unique journals and evidence levels for filters
  const journals = await getUniqueJournals()
  const evidenceLevels = await getDistinctEvidenceLevels()

  // Fetch trending articles (only show on first page with no filters)
  const showTrending = filters.page === 1 && !filters.search &&
    filters.labels.length === 0 && filters.evidence.length === 0 &&
    filters.journals.length === 0 && filters.quickFilter === DEFAULT_QUICK_FILTER

  const { articles: trendingArticles } = showTrending
    ? await getTrendingArticles()
    : { articles: [] }

  // Fetch personalized articles (only show on first page with no filters)
  const { articles: personalizedArticles, hasFollowedTags } = showTrending
    ? await getPersonalizedArticles()
    : { articles: [], hasFollowedTags: null }
  // Signed-in readers who follow nothing are invited to pick specialties (signup no longer asks).
  // Page middleware already sends unverified accounts to /verify-email.
  const showPersonalizeCard = !!user && hasFollowedTags === false

  // Deduplicate main feed articles to avoid showing same articles in personalized feed
  const personalizedIds = new Set(personalizedArticles.map(a => a.id))
  const deduplicatedArticles = articles?.filter(a => !personalizedIds.has(a.id)) || []

  const totalPages = Math.ceil((count || 0) / 20)

  const hasActiveFilters = filters.search || filters.labels.length > 0 ||
    filters.evidence.length > 0 || filters.journals.length > 0 ||
    filters.quickFilter !== DEFAULT_QUICK_FILTER

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <SearchControls
        initialFilters={filters}
        availableJournals={journals}
        availableEvidenceLevels={evidenceLevels}
        resultsCount={count || 0}
      >
      {isSearch ? (
        // Keyed by the whole search: every new search / filter / order change re-suspends, so
        // the sprout shows however the search started (box, link, filter click, reload).
        <Suspense
          key={searchKeyFor(filters)}
          fallback={
            <div role="status" style={{ padding: '48px 16px 80px' }}>
              <SproutLoader state="growing" label="Searching…" />
            </div>
          }
        >
          <SearchResults filters={filters} isLoggedIn={isLoggedIn} newThisWeek={newThisWeek ?? undefined} />
        </Suspense>
      ) : (<>
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
            {showPersonalizeCard && user && <PersonalizeCard userId={user.id} />}

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
          <SynthesisWrapper searchQuery={filters.search} isLoggedIn={isLoggedIn} view={filters.view}>
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
      </>)}
      </SearchControls>
    </>
  )
}
