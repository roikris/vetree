import { ParsedFilters } from '@/types/search'
import { hasActiveFilters, getFilterSummary } from '@/lib/utils/filters'

type ResultsCountProps = {
  total: number
  showing: number
  filters: ParsedFilters
}

export function ResultsCount({ total, showing, filters }: ResultsCountProps) {
  const hasFilters = hasActiveFilters(filters)
  const summary = getFilterSummary(filters)

  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">
          {total.toLocaleString()} {total === 1 ? 'article' : 'articles'}
        </h2>
        {hasFilters && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            ({summary})
          </span>
        )}
      </div>
      {showing < total && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Showing {showing} on this page
        </p>
      )}
    </div>
  )
}
