import { supabase } from '@/lib/supabase'
import { ParsedFilters } from '@/types/search'
import { normalizeQuery } from '@/lib/utils/normalizeQuery'

// Sanitize search terms to prevent PostgREST query parsing errors
function sanitizeSearchTerm(term: string): string {
  // Remove special characters that break PostgREST parsing: ( ) , . % _ [ ] * ? \
  // Replace with spaces and trim
  return term.replace(/[(),.%_[\]*?\\]/g, ' ').trim()
}

type SearchResult = {
  data: any[] | null
  count: number | null
  error?: any
  searchTier?: 'exact' | 'ilike' | 'fuzzy'
}

export async function searchArticles(filters: ParsedFilters, pageSize = 20): Promise<SearchResult> {
  try {
    // Apply misspelling correction first
    const correctedSearch = filters.search ? normalizeQuery(filters.search) : filters.search

    // Base query builder function
    const buildBaseQuery = () => {
      return supabase
        .from('articles')
        .select('*', { count: 'exact' })
        .eq('needs_enrichment', false)
        .not('summary', 'is', null)
        .not('clinical_bottom_line', 'is', null)
        .or('quarantined.is.null,quarantined.eq.false')
    }

    let searchResult: SearchResult | null = null
    let searchTier: 'exact' | 'ilike' | 'fuzzy' = 'exact'

    // Perform 3-tier search if search query exists
    if (filters.search && correctedSearch) {
      const sanitizedSearch = sanitizeSearchTerm(correctedSearch)

      if (!sanitizedSearch) {
        return {
          data: [],
          count: 0,
          error: { message: 'No articles found. Try different search terms.' }
        }
      }

      // TIER 1: Full-text search (fastest, most precise)
      try {
        const ftsQuery = buildBaseQuery()
          .textSearch('title', sanitizedSearch, { type: 'websearch' })

        const { data: ftsData, count: ftsCount } = await ftsQuery

        if (ftsData && ftsData.length >= 3) {
          searchResult = { data: ftsData, count: ftsCount, searchTier: 'exact' }
          searchTier = 'exact'
        }
      } catch (e) {
        console.log('[Search] FTS failed, trying ILIKE')
      }

      // TIER 2: ILIKE fallback (handles partial matches)
      if (!searchResult) {
        const ilikeQuery = buildBaseQuery()
          .or(
            `title.ilike.%${sanitizedSearch}%,summary.ilike.%${sanitizedSearch}%,clinical_bottom_line.ilike.%${sanitizedSearch}%,authors.ilike.%${sanitizedSearch}%`
          )

        const { data: ilikeData, count: ilikeCount } = await ilikeQuery

        if (ilikeData && ilikeData.length >= 3) {
          searchResult = { data: ilikeData, count: ilikeCount, searchTier: 'ilike' }
          searchTier = 'ilike'
        }
      }

      // TIER 3: Trigram fuzzy search (handles typos)
      if (!searchResult) {
        try {
          const { data: fuzzyData, error: fuzzyError } = await supabase
            .rpc('search_articles_fuzzy', {
              search_query: sanitizedSearch,
              similarity_threshold: 0.3
            })

          if (fuzzyData && fuzzyData.length > 0) {
            searchResult = { data: fuzzyData, count: fuzzyData.length, searchTier: 'fuzzy' }
            searchTier = 'fuzzy'
          }
        } catch (e) {
          console.log('[Search] Fuzzy search not available:', e)
        }
      }

      // If no results from any tier
      if (!searchResult) {
        return {
          data: [],
          count: 0,
          error: { message: 'No articles found. Try different search terms.' },
          searchTier
        }
      }

      // Use the best result we found
      var query = supabase
        .from('articles')
        .select('*', { count: 'exact' })
        .in('id', searchResult.data!.map((a: any) => a.id))
    } else {
      // No search query - use base query
      query = buildBaseQuery()
    }

    // Quick filter (Small Animal or Large Animal)
    if (filters.quickFilter !== 'all') {
      const quickLabel = filters.quickFilter === 'small-animal' ? 'Small Animal' : 'Large Animal'
      query = query.overlaps('labels', [quickLabel])
    }

    // Filter by labels (specialty checkboxes)
    if (filters.labels.length > 0) {
      if (filters.labelOperator === 'AND') {
        query = query.contains('labels', filters.labels)
      } else {
        query = query.overlaps('labels', filters.labels)
      }
    }

    // Filter by evidence
    if (filters.evidence.length > 0) {
      query = query.in('strength_of_evidence', filters.evidence)
    }

    // Filter by journals
    if (filters.journals.length > 0) {
      query = query.in('source_journal', filters.journals)
    }

    // Sort
    if (filters.sort === 'newest' || filters.sort === 'relevance') {
      query = query.order('publication_date', { ascending: false })
    } else if (filters.sort === 'oldest') {
      query = query.order('publication_date', { ascending: true })
    }

    // Pagination
    const from = (filters.page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const result = await query

    // If there's an error, return a user-friendly message
    if (result.error) {
      console.error('Search error:', result.error)
      return {
        data: [],
        count: 0,
        error: { message: 'No articles found. Try different search terms.' },
        searchTier
      }
    }

    return {
      ...result,
      searchTier
    }
  } catch (error) {
    console.error('Unexpected search error:', error)
    return {
      data: [],
      count: 0,
      error: { message: 'No articles found. Try different search terms.' }
    }
  }
}

export async function getUniqueJournals() {
  const { data } = await supabase
    .from('articles')
    .select('source_journal')
    .not('source_journal', 'is', null)
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')

  if (!data) return []

  const journals = [...new Set(data.map(d => d.source_journal))].sort()
  return journals as string[]
}

export async function getDistinctEvidenceLevels() {
  const { data } = await supabase
    .from('articles')
    .select('strength_of_evidence')
    .not('strength_of_evidence', 'is', null)
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')

  if (!data) return []

  const levels = [...new Set(data.map(d => d.strength_of_evidence))].sort()
  return levels as string[]
}
