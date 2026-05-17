import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { ParsedFilters } from '@/types/search'
import { normalizeQuery } from '@/lib/utils/normalizeQuery'

// Only fetch fields needed for article list cards — summary fetched lazily
const SELECT_FIELDS = `
  id,
  title,
  clinical_bottom_line,
  labels,
  source_journal,
  publication_date,
  strength_of_evidence,
  authors,
  article_url,
  doi,
  pubmed_id
`

// Sanitize search terms to prevent PostgREST query parsing errors
function sanitizeSearchTerm(term: string): string {
  // Remove special characters that break PostgREST parsing: ( ) , . % _ [ ] * ? \
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
    const correctedSearch = filters.search ? normalizeQuery(filters.search) : filters.search

    const buildBaseQuery = () => {
      return supabase
        .from('articles')
        .select(SELECT_FIELDS, { count: 'exact' })
        .eq('needs_enrichment', false)
        .not('summary', 'is', null)
        .not('clinical_bottom_line', 'is', null)
        .or('quarantined.is.null,quarantined.eq.false')
    }

    // Pre-compute pagination bounds
    const from = (filters.page - 1) * pageSize
    const to = from + pageSize - 1

    // Apply label/evidence/journal filters + sort + pagination to any query
    const applyFiltersAndPagination = (q: any) => {
      if (filters.quickFilter !== 'all') {
        const quickLabel = filters.quickFilter === 'small-animal' ? 'Small Animal' : 'Large Animal'
        q = q.overlaps('labels', [quickLabel])
      }
      if (filters.labels.length > 0) {
        if (filters.labelOperator === 'AND') {
          q = q.contains('labels', filters.labels)
        } else {
          q = q.overlaps('labels', filters.labels)
        }
      }
      if (filters.evidence.length > 0) {
        q = q.in('strength_of_evidence', filters.evidence)
      }
      if (filters.journals.length > 0) {
        q = q.in('source_journal', filters.journals)
      }
      const ascending = filters.sort === 'oldest'
      q = q.order('publication_date', { ascending })
      q = q.range(from, to)
      return q
    }

    if (filters.search && correctedSearch) {
      const sanitizedSearch = sanitizeSearchTerm(correctedSearch)

      if (!sanitizedSearch) {
        return { data: [], count: 0 }
      }

      const LARGE_ANIMAL = ['Equine','equine','Large Animal','large animal','Livestock','livestock','Poultry','poultry','Food Animal','food animal']

      // PRIMARY: Ranked multi-field search via RPC (title A, labels B, CBL B, summary C)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('search_articles_ranked', {
          search_query: sanitizedSearch,
          result_limit: 50
        })

      if (!rpcError && rpcData && rpcData.length > 0) {
        let filtered: any[] = rpcData.filter((a: any) =>
          !a.labels?.some((l: string) => LARGE_ANIMAL.includes(l))
        )
        if (filters.quickFilter !== 'all') {
          const quickLabel = filters.quickFilter === 'small-animal' ? 'Small Animal' : 'Large Animal'
          filtered = filtered.filter((a: any) => a.labels?.includes(quickLabel))
        }
        if (filters.labels.length > 0) {
          if (filters.labelOperator === 'AND') {
            filtered = filtered.filter((a: any) =>
              filters.labels.every((l: string) => a.labels?.includes(l))
            )
          } else {
            filtered = filtered.filter((a: any) =>
              filters.labels.some((l: string) => a.labels?.includes(l))
            )
          }
        }
        if (filters.evidence.length > 0) {
          filtered = filtered.filter((a: any) => filters.evidence.includes(a.strength_of_evidence))
        }
        if (filters.journals.length > 0) {
          filtered = filtered.filter((a: any) => filters.journals.includes(a.source_journal))
        }
        // Re-sort by date only when explicitly requested; default keeps RPC relevance order
        if (filters.sort === 'oldest') {
          filtered.sort((a: any, b: any) =>
            new Date(a.publication_date).getTime() - new Date(b.publication_date).getTime()
          )
        } else if (filters.sort === 'newest') {
          filtered.sort((a: any, b: any) =>
            new Date(b.publication_date).getTime() - new Date(a.publication_date).getTime()
          )
        }
        const count = filtered.length
        const from = (filters.page - 1) * pageSize
        return { data: filtered.slice(from, from + pageSize), count, searchTier: 'exact' }
      }

      // FALLBACK: Old 3-tier search if RPC returns 0 results
      // (e.g. search_vector not yet populated for newly enriched articles)

      // TIER 1: Full-text search on title
      try {
        const ftsBase = buildBaseQuery()
          .textSearch('title', sanitizedSearch, { type: 'websearch' })
        const { data, count, error } = await applyFiltersAndPagination(ftsBase)
        if (!error && (count ?? 0) >= 3) {
          return { data, count, searchTier: 'exact' }
        }
      } catch {
        console.log('[Search] FTS failed, trying ILIKE')
      }

      // TIER 2: ILIKE fallback
      const ilikeBase = buildBaseQuery().or(
        `title.ilike.%${sanitizedSearch}%,summary.ilike.%${sanitizedSearch}%,clinical_bottom_line.ilike.%${sanitizedSearch}%,authors.ilike.%${sanitizedSearch}%`
      )
      const { data: ilikeData, count: ilikeCount, error: ilikeError } = await applyFiltersAndPagination(ilikeBase)
      if (!ilikeError && (ilikeCount ?? 0) >= 3) {
        return { data: ilikeData, count: ilikeCount, searchTier: 'ilike' }
      }

      // TIER 3: Trigram fuzzy
      try {
        const { data: fuzzyData } = await supabase
          .rpc('search_articles_fuzzy', {
            search_query: sanitizedSearch,
            similarity_threshold: 0.3
          })
        if (fuzzyData && fuzzyData.length > 0) {
          const fuzzyBase = supabase
            .from('articles')
            .select(SELECT_FIELDS, { count: 'exact' })
            .in('id', fuzzyData.map((a: any) => a.id))
            .eq('needs_enrichment', false)
            .not('summary', 'is', null)
            .not('clinical_bottom_line', 'is', null)
            .or('quarantined.is.null,quarantined.eq.false')
          const { data, count } = await applyFiltersAndPagination(fuzzyBase)
          return { data, count, searchTier: 'fuzzy' }
        }
      } catch (e) {
        console.log('[Search] Fuzzy search not available:', e)
      }

      return { data: [], count: 0, searchTier: 'exact' }
    }

    // No search query — apply filters + pagination directly
    const result = await applyFiltersAndPagination(buildBaseQuery())

    if (result.error) {
      console.error('Search error:', result.error)
      return {
        data: [],
        count: 0,
        error: { message: 'Search is temporarily unavailable. Please try again.' }
      }
    }

    return result
  } catch (error) {
    console.error('Unexpected search error:', error)
    return {
      data: [],
      count: 0,
      error: { message: 'Search is temporarily unavailable. Please try again.' }
    }
  }
}

// FIX 2: Cache for 1 hour — these never change between page navigations
export const getUniqueJournals = unstable_cache(
  async () => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await client
      .from('articles')
      .select('source_journal')
      .not('source_journal', 'is', null)
      .eq('needs_enrichment', false)
      .not('summary', 'is', null)
      .not('clinical_bottom_line', 'is', null)
      .or('quarantined.is.null,quarantined.eq.false')

    if (!data) return [] as string[]
    return [...new Set(data.map(d => d.source_journal))].filter(Boolean).sort() as string[]
  },
  ['unique-journals'],
  { revalidate: 3600 }
)

export const getDistinctEvidenceLevels = unstable_cache(
  async () => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await client
      .from('articles')
      .select('strength_of_evidence')
      .not('strength_of_evidence', 'is', null)
      .eq('needs_enrichment', false)
      .not('summary', 'is', null)
      .not('clinical_bottom_line', 'is', null)
      .or('quarantined.is.null,quarantined.eq.false')

    if (!data) return [] as string[]
    return [...new Set(data.map(d => d.strength_of_evidence))].filter(Boolean).sort() as string[]
  },
  ['distinct-evidence-levels'],
  { revalidate: 3600 }
)
