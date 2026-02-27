import { ParsedFilters, SortOption, LabelOperator, QuickFilter } from '@/types/search'

export function parseSearchParams(
  searchParams: { [key: string]: string | string[] | undefined }
): ParsedFilters {
  const search = typeof searchParams.search === 'string' ? searchParams.search : ''

  const labels = Array.isArray(searchParams.labels)
    ? searchParams.labels
    : typeof searchParams.labels === 'string'
    ? [searchParams.labels]
    : []

  const labelOperatorParam = typeof searchParams.labelOperator === 'string' ? searchParams.labelOperator : 'OR'
  const labelOperator: LabelOperator = ['OR', 'AND'].includes(labelOperatorParam)
    ? (labelOperatorParam as LabelOperator)
    : 'OR'

  const quickFilterParam = typeof searchParams.quickFilter === 'string' ? searchParams.quickFilter : 'all'
  const quickFilter: QuickFilter = ['all', 'small-animal', 'large-animal'].includes(quickFilterParam)
    ? (quickFilterParam as QuickFilter)
    : 'all'

  const evidence = Array.isArray(searchParams.evidence)
    ? searchParams.evidence
    : typeof searchParams.evidence === 'string'
    ? [searchParams.evidence]
    : []

  const journals = Array.isArray(searchParams.journals)
    ? searchParams.journals
    : typeof searchParams.journals === 'string'
    ? [searchParams.journals]
    : []

  const sortParam = typeof searchParams.sort === 'string' ? searchParams.sort : 'newest'
  const sort: SortOption = ['newest', 'oldest', 'relevance'].includes(sortParam)
    ? (sortParam as SortOption)
    : 'newest'

  const pageParam = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  return {
    search,
    labels,
    labelOperator,
    quickFilter,
    evidence,
    journals,
    sort,
    page
  }
}

export function buildSearchParams(filters: ParsedFilters): string {
  const params = new URLSearchParams()

  if (filters.search) {
    params.set('search', filters.search)
  }

  filters.labels.forEach(label => {
    params.append('labels', label)
  })

  if (filters.labelOperator !== 'OR') {
    params.set('labelOperator', filters.labelOperator)
  }

  if (filters.quickFilter !== 'all') {
    params.set('quickFilter', filters.quickFilter)
  }

  filters.evidence.forEach(level => {
    params.append('evidence', level)
  })

  filters.journals.forEach(journal => {
    params.append('journals', journal)
  })

  if (filters.sort !== 'newest') {
    params.set('sort', filters.sort)
  }

  if (filters.page > 1) {
    params.set('page', filters.page.toString())
  }

  return params.toString()
}
