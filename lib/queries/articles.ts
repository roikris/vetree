import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { ParsedFilters } from '@/types/search'
import { applyQuickFilter } from '@/lib/utils/species'

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
export function sanitizeSearchTerm(term: string): string {
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
      // Unique tie-breaker: many articles share a date, and without it offset pages can
      // repeat or skip rows as Postgres returns ties in any order
      q = q.order('id', { ascending: true })
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

    // Searches no longer come through here: they run progressively through
    // lib/search/progressive.ts (search_articles_batch, migration 060). This function serves
    // the browsing feed only; a search reaching it is a routing bug, so fail loudly.
    if (filters.search?.trim()) {
      throw new Error('searchArticles is feed-only; searches use lib/search/progressive')
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

export type FallbackResult = {
  data: any[]
  tier: 'exact' | 'ilike' | 'fuzzy' | null
  /** true when the tier hit FALLBACK_CAP, i.e. more closest matches exist */
  capped: boolean
}

export const FALLBACK_CAP = 200
const FUZZY_RPC_CAP = 100

/**
 * Closest-match fallback for a search whose full-text batch found NOTHING (typos, author
 * names — lib/search/progressive.ts calls it only after a successful empty first batch).
 * ILIKE on title / bottom line / authors, then trigram fuzzy (started together; title FTS only
 * for negated queries — see below), filters applied in SQL, one capped
 * list instead of pages: up to
 * FALLBACK_CAP rows, newest first. Errors THROW — a failed fallback must surface as an error,
 * never as an empty "no coverage" result.
 */
export async function fallbackSearch(filters: ParsedFilters, sanitizedSearch: string): Promise<FallbackResult> {
  const base = () => supabase
    .from('articles')
    .select(SELECT_FIELDS)
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')

  const scoped = (q: any) => {
    q = applyQuickFilter(q, filters.quickFilter)
    if (filters.labels.length > 0) {
      q = filters.labelOperator === 'AND' ? q.contains('labels', filters.labels) : q.overlaps('labels', filters.labels)
    }
    if (filters.evidence.length > 0) q = q.in('strength_of_evidence', filters.evidence)
    if (filters.journals.length > 0) q = q.in('source_journal', filters.journals)
    return q.order('publication_date', { ascending: false }).order('id', { ascending: true }).range(0, FALLBACK_CAP - 1)
  }

  const done = (data: any[] | null, tier: FallbackResult['tier']): FallbackResult =>
    ({ data: data ?? [], tier, capped: (data?.length ?? 0) >= FALLBACK_CAP })

  // Title full-text tier ONLY for queries that may contain a negation ("asthma -cats"). This runs after
  // search_articles_batch returned zero rows for the same text and scope, and its search_vector
  // contains to_tsvector('english', title) under identical visibility/species filters — so for a
  // positive query a title match is impossible and the tier (a sequential scan, ~3.4 s via anon,
  // most of the 3–10 s every zero-result search used to take) is skipped. A negation can reject a
  // whole article on a word in its summary while its title alone still matches, so it keeps the
  // tier. Any '-' counts: PostgreSQL's websearch parser also negates "a - b", a leading "- b"
  // and a '-' right after a closing quote, so only a query with no '-' is provably safe to skip.
  // Hyphenated words ("x-ray") keep the slower tier too — rare, and correct. (Codex, 2026-09-30.)
  if (sanitizedSearch.includes('-')) {
    const fts = await scoped(base().textSearch('title', sanitizedSearch, { type: 'websearch' }))
    if (fts.error) throw new Error(`fallback FTS failed: ${fts.error.message}`)
    if (fts.data && fts.data.length > 0) return done(fts.data, 'exact')
  }

  // ILIKE (author names, substrings) and trigram fuzzy (typos) start together; ILIKE wins if it
  // finds anything, exactly as when they ran one after the other — and then nothing waits for
  // the fuzzy lookup. (Supabase builders are lazy: .then() starts the request now.)
  const fuzzyRpc = supabase
    .rpc('search_articles_fuzzy', { search_query: sanitizedSearch, similarity_threshold: 0.3 })
    .then(r => r, (e: unknown) => ({ data: null, error: { message: String(e) } }))
  const ilike = await scoped(base().or(
    `title.ilike.%${sanitizedSearch}%,clinical_bottom_line.ilike.%${sanitizedSearch}%,authors.ilike.%${sanitizedSearch}%`
  ))
  if (ilike.error) throw new Error(`fallback ILIKE failed: ${ilike.error.message}`)
  if (ilike.data && ilike.data.length > 0) return done(ilike.data, 'ilike')

  const { data: fuzzyIds, error: fuzzyError } = await fuzzyRpc
  if (fuzzyError) throw new Error(`fallback fuzzy failed: ${fuzzyError.message}`)
  if (!fuzzyIds || fuzzyIds.length === 0) return done([], null)
  const fuzzy = await scoped(base().in('id', fuzzyIds.map((a: any) => a.id)))
  if (fuzzy.error) throw new Error(`fallback fuzzy fetch failed: ${fuzzy.error.message}`)
  const result = done(fuzzy.data, fuzzy.data && fuzzy.data.length > 0 ? 'fuzzy' : null)
  // search_articles_fuzzy returns at most FUZZY_RPC_CAP candidates (LIMIT 100, migration 056):
  // a full candidate list means more close matches may exist, even after filters trim it
  if (fuzzyIds.length >= FUZZY_RPC_CAP && result.data.length > 0) result.capped = true
  return result
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
