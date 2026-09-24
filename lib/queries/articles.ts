import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { ParsedFilters } from '@/types/search'
import { normalizeQuery } from '@/lib/utils/normalizeQuery'
import { applyQuickFilter, matchesQuickFilter } from '@/lib/utils/species'

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
        .select(SELECT_FIELDS, { count: 'estimated' }) // 'exact' causes full COUNT(*) scan → timeout
        .eq('needs_enrichment', false)
        .not('summary', 'is', null)
        .not('clinical_bottom_line', 'is', null)
        .or('quarantined.is.null,quarantined.eq.false')
    }

    // Pre-compute pagination bounds
    const from = (filters.page - 1) * pageSize
    const to = from + pageSize - 1

    // Apply label/evidence/journal filters + sort to any query
    const applyFilters = (q: any) => {
      q = applyQuickFilter(q, filters.quickFilter)
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
      return q
    }

    // Filters + the requested page. A page past the end (e.g. page 2 of a 2-result match,
    // reachable by URL) makes PostgREST answer 416 / PGRST103 with count: null, which the
    // callers would read as "no results" or "search unavailable". In that case, fetch the
    // count on its own and return an empty page with the recovered total.
    const runPaged = async (makeBase: () => any) => {
      const res = await applyFilters(makeBase()).range(from, to)
      if (res.error?.code !== 'PGRST103') return res
      const { count, error } = await applyFilters(makeBase()).range(0, 0)
      return { data: [], count, error }
    }

    if (filters.search && correctedSearch) {
      const sanitizedSearch = sanitizeSearchTerm(correctedSearch)

      if (!sanitizedSearch) {
        return { data: [], count: 0 }
      }

      // PRIMARY: Ranked multi-field search via RPC (title A, labels B, CBL B, summary C)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('search_articles_ranked', {
          search_query: sanitizedSearch,
          // 200, not 50: species scoping (small animal by default) is applied to these
          // results in JS, so a 50-row pool left common terms badly short — 'diarrhea'
          // kept 14 of 50 under the default scope versus 81 of 200. 200 is also the
          // function's internal candidate ceiling, so the database does the same work.
          result_limit: 200
        })

      // If RPC timed out, don't cascade into slow ILIKE fallbacks — bail immediately
      if (rpcError?.code === '57014') {
        console.error('[Search] RPC timeout, not falling through to ILIKE')
        return { data: [], count: 0, error: { message: 'Search is temporarily unavailable. Please try again.' } }
      }

      if (!rpcError && rpcData && rpcData.length > 0) {
        // Species scoping comes from quickFilter only, with the same semantics as the
        // SQL browse path (lib/utils/species.ts): the default excludes large-animal-only
        // articles rather than requiring a 'Small Animal' label.
        let filtered: any[] = rpcData.filter((a: any) =>
          matchesQuickFilter(a.labels, filters.quickFilter)
        )
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
        // If scoping emptied the ranked pool, don't report "no results": the fallback
        // tiers below apply the same scope inside SQL across the whole table, so they can
        // still find matches ranked outside this pool.
        if (filtered.length > 0) {
          const count = filtered.length
          const from = (filters.page - 1) * pageSize
          return { data: filtered.slice(from, from + pageSize), count, searchTier: 'exact' }
        }
      }

      // FALLBACK: Old 3-tier search if RPC returns 0 results
      // (e.g. search_vector not yet populated for newly enriched articles)

      // Each tier below needs >= 3 matches to win outright, but a tier that finds 1–2 real
      // matches must not be thrown away if the later tiers find nothing — with species
      // scoping, those 1–2 can be the only in-scope matches that exist. Keep the best
      // non-empty partial and return it instead of an empty result.
      let partial: SearchResult | null = null

      // TIER 1: Full-text search on title
      try {
        const { data, count, error } = await runPaged(() =>
          buildBaseQuery().textSearch('title', sanitizedSearch, { type: 'websearch' })
        )
        if (!error && (count ?? 0) >= 3) {
          return { data, count, searchTier: 'exact' }
        }
        if (!error && (count ?? 0) > 0) partial = { data, count, searchTier: 'exact' }
      } catch {
        console.log('[Search] FTS failed, trying ILIKE')
      }

      // TIER 2: ILIKE fallback — summary excluded (long text, causes statement timeout)
      const { data: ilikeData, count: ilikeCount, error: ilikeError } = await runPaged(() =>
        buildBaseQuery().or(
          `title.ilike.%${sanitizedSearch}%,clinical_bottom_line.ilike.%${sanitizedSearch}%,authors.ilike.%${sanitizedSearch}%`
        )
      )
      if (!ilikeError && (ilikeCount ?? 0) >= 3) {
        return { data: ilikeData, count: ilikeCount, searchTier: 'ilike' }
      }
      // ILIKE covers title, bottom line and authors, so prefer it over a title-only FTS partial
      if (!ilikeError && (ilikeCount ?? 0) > 0) partial = { data: ilikeData, count: ilikeCount, searchTier: 'ilike' }

      // TIER 3: Trigram fuzzy
      try {
        const { data: fuzzyData } = await supabase
          .rpc('search_articles_fuzzy', {
            search_query: sanitizedSearch,
            similarity_threshold: 0.3
          })
        if (fuzzyData && fuzzyData.length > 0) {
          const fuzzyBase = () => supabase
            .from('articles')
            .select(SELECT_FIELDS, { count: 'exact' })
            .in('id', fuzzyData.map((a: any) => a.id))
            .eq('needs_enrichment', false)
            .not('summary', 'is', null)
            .not('clinical_bottom_line', 'is', null)
            .or('quarantined.is.null,quarantined.eq.false')
          const { data, count } = await runPaged(fuzzyBase)
          // The fuzzy RPC is not species-scoped; scoping is applied here, and can empty it
          if ((count ?? 0) > 0) return { data, count, searchTier: 'fuzzy' }
        }
      } catch (e) {
        console.log('[Search] Fuzzy search not available:', e)
      }

      return partial ?? { data: [], count: 0, searchTier: 'exact' }
    }

    // No search query — apply filters + pagination directly
    const result = await runPaged(buildBaseQuery)

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
