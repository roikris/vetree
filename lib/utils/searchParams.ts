import { ParsedFilters, SortOption, LabelOperator, QuickFilter, FeedView } from '@/types/search'
import { defaultQuickFilterFor } from '@/lib/utils/species'

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

  // Missing or invalid -> the context default: all species for a search, small animal for the feed
  const defaultScope = defaultQuickFilterFor(search)
  const quickFilterParam = typeof searchParams.quickFilter === 'string' ? searchParams.quickFilter : defaultScope
  const quickFilter: QuickFilter = ['all', 'small-animal', 'large-animal'].includes(quickFilterParam)
    ? (quickFilterParam as QuickFilter)
    : defaultScope

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

  const viewParam = typeof searchParams.view === 'string' ? searchParams.view : 'stream'
  const view: FeedView = ['stream', 'grove', 'list'].includes(viewParam) ? (viewParam as FeedView) : 'stream'

  return {
    search,
    labels,
    labelOperator,
    quickFilter,
    evidence,
    journals,
    sort,
    page,
    view,
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

  // Omit the CONTEXT default (all species with a search, small animal without), so an
  // explicit choice that differs from it round-trips through the URL.
  if (filters.quickFilter !== defaultQuickFilterFor(filters.search)) {
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

  if (filters.view && filters.view !== 'stream') {
    params.set('view', filters.view)
  }

  // Every URL built here is a feed URL (filter bar, pagination, feed wrapper). Without
  // `browse`, an all-default feed URL serialises to a bare `/?`, which app/page.tsx treats
  // as a fresh logged-out visit and replaces the feed with the landing page — e.g. a guest
  // switching species back to the default, clearing a search, or opening grove view.
  // `browse` only affects logged-out visitors, so it is inert for everyone else.
  params.set('browse', '1')

  return params.toString()
}
