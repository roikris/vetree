import { ParsedFilters } from '@/types/search'
import { runSearchBatch } from '@/lib/search/progressive'
import { ProgressiveResults } from '@/components/search/ProgressiveResults'
import { SynthesisWrapper } from '@/components/synthesis/SynthesisWrapper'
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner'

type Props = {
  filters: ParsedFilters
  isLoggedIn: boolean
  newThisWeek?: number
}

/**
 * First batch of a search, rendered on the server inside a keyed <Suspense> (app/page.tsx),
 * so the sprout loader shows for every way a search starts — the search box, links, filter
 * clicks, reloads, direct visits. Later batches come from GET /api/search/batch.
 * A failed search renders the error state and never mounts ProgressiveResults, so it is
 * never logged as a zero-result search.
 */
export async function SearchResults({ filters, isLoggedIn, newThisWeek }: Props) {
  const result = await runSearchBatch(filters, null)

  if (!result.ok) {
    return (
      <div style={{ maxWidth: 704, margin: '24px auto', padding: '0 32px' }}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4" role="alert">
          <p className="text-red-800 dark:text-red-200">{result.error}</p>
        </div>
      </div>
    )
  }

  return (
    <div id="articles">
      <div style={{ maxWidth: filters.view === 'list' ? 844 : 704, margin: '0 auto', padding: '0 32px' }}>
        <DisclaimerBanner />
      </div>
      <SynthesisWrapper searchQuery={filters.search} isLoggedIn={isLoggedIn} view={filters.view}>
        <ProgressiveResults
          filters={filters}
          initialArticles={result.articles}
          initialCursor={result.nextCursor}
          initialDone={result.done}
          disclosure={result.disclosure}
          newThisWeek={newThisWeek}
        />
      </SynthesisWrapper>
    </div>
  )
}
