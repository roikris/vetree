import { ParsedFilters } from '@/types/search'

export function hasActiveFilters(filters: ParsedFilters): boolean {
  return (
    !!filters.search ||
    filters.labels.length > 0 ||
    filters.quickFilter !== 'all' ||
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

  if (filters.quickFilter !== 'all') {
    const label = filters.quickFilter === 'small-animal' ? 'Small Animal' : 'Large Animal'
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
    quickFilter: 'all',
    evidence: [],
    journals: [],
    sort: 'newest',
    page: 1
  }
}
