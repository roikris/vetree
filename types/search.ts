import { Article } from '@/lib/supabase'

export type SortOption = 'newest' | 'oldest' | 'relevance'
export type LabelOperator = 'OR' | 'AND'
export type QuickFilter = 'all' | 'small-animal' | 'large-animal'

export type ParsedFilters = {
  search: string
  labels: string[]
  labelOperator: LabelOperator
  quickFilter: QuickFilter
  evidence: string[]
  journals: string[]
  sort: SortOption
  page: number
}

export type ArticleSearchResult = {
  articles: Article[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
