import { ParsedFilters } from '@/types/search'
import { DEFAULT_QUICK_FILTER, defaultQuickFilterFor } from '@/lib/utils/species'

export function hasActiveFilters(filters: ParsedFilters): boolean {
  return (
    !!filters.search ||
    filters.labels.length > 0 ||
    filters.quickFilter !== defaultQuickFilterFor(filters.search) ||
    filters.evidence.length > 0 ||
    filters.journals.length > 0 ||
    filters.sort !== 'newest'
  )
}

export function getFilterSummary(filters: ParsedFilters): string {
  const parts: string[] = []

  if (filters.search) {
    parts.push(`Search: "${filters.search}"`)
  }

  if (filters.quickFilter !== defaultQuickFilterFor(filters.search)) {
    const label = filters.quickFilter === 'large-animal' ? 'Large Animal'
      : filters.quickFilter === 'small-animal' ? 'Small Animal' : 'All species'
    parts.push(label)
  }

  if (filters.labels.length > 0) {
    const operator = filters.labelOperator === 'AND' ? ' (all)' : ''
    parts.push(`${filters.labels.length} specialty${filters.labels.length > 1 ? 's' : ''}${operator}`)
  }

  if (filters.evidence.length > 0) {
    parts.push(`${filters.evidence.length} evidence level${filters.evidence.length > 1 ? 's' : ''}`)
  }

  if (filters.journals.length > 0) {
    parts.push(`${filters.journals.length} journal${filters.journals.length > 1 ? 's' : ''}`)
  }

  return parts.join(', ')
}

export function getDefaultFilters(): ParsedFilters {
  return {
    search: '',
    labels: [],
    labelOperator: 'OR',
    quickFilter: DEFAULT_QUICK_FILTER,
    evidence: [],
    journals: [],
    sort: 'newest',
    page: 1,
    view: 'stream',
  }
}
