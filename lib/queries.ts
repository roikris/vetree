import { createReadOnlyClient, queryCache, BatchOperations, logSlowQuery } from '@/lib/database'
import { ParsedFilters } from '@/types/search'
import { normalizeQuery } from '@/lib/utils/normalizeQuery'

// Sanitize search terms to prevent PostgREST query parsing errors
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[(),.%_[\]*?\\]/g, ' ').trim()
}

type SearchResult = {
  data: any[] | null
  count: number | null
  error?: any
  searchTier?: 'exact' | 'ilike' | 'fuzzy'
}

export async function searchArticles(filters: ParsedFilters, pageSize = 20): Promise<SearchResult> {
  const startTime = Date.now()
  const cacheKey = `search:${JSON.stringify(filters)}:${pageSize}`
  
  // Check cache first
  const cached = queryCache.get<SearchResult>(cacheKey)
  if (cached) {
    logSlowQuery('searchArticles (cached)', Date.now() - startTime)
    return cached
  }

  try {
    const supabase = createReadOnlyClient()
    const correctedSearch = filters.search ? normalizeQuery(filters.search) : filters.search

    // Base query builder function with optimized selection
    const buildBaseQuery = () => {
      return supabase
        .from('articles')
        .select(`
          id,
          title,
          summary,
          clinical_bottom_line,
          strength_of_evidence,
          labels,
          source_journal,
          article_url,
          doi,
          authors,
          pubmed_id,
          publication_date
        `, { count: 'exact' })
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

      // Use the best result we found with optimized query
      var query = supabase
        .from('articles')
        .select(`
          id,
          title,
          summary,
          clinical_bottom_line,
          strength_of_evidence,
          labels,
          source_journal,
          article_url,
          doi,
          authors,
          pubmed_id,
          publication_date
        `, { count: 'exact' })
        .in('id', searchResult.data!.map((a: any) => a.id))
    } else {
      // No search query - use base query
      query = buildBaseQuery()
    }

    // Apply filters with optimized ordering
    if (filters.quickFilter !== 'all') {
      const quickLabel = filters.quickFilter === 'small-animal' ? 'Small Animal' : 'Large Animal'
      query = query.overlaps('labels', [quickLabel])
    }

    if (filters.labels.length > 0) {
      if (filters.labelOperator === 'AND') {
        query = query.contains('labels', filters.labels)
      } else {
        query = query.overlaps('labels', filters.labels)
      }
    }

    if (filters.evidence.length > 0) {
      query = query.in('strength_of_evidence', filters.evidence)
    }

    if (filters.journals.length > 0) {
      query = query.in('source_journal', filters.journals)
    }

    // Optimized sorting
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

    if (result.error) {
      console.error('Search error:', result.error)
      return {
        data: [],
        count: 0,
        error: { message: 'No articles found. Try different search terms.' },
        searchTier
      }
    }

    const finalResult = {
      ...result,
      searchTier
    }

    // Cache successful results
    queryCache.set(cacheKey, finalResult, 180) // 3 minutes

    logSlowQuery('searchArticles', Date.now() - startTime)
    return finalResult

  } catch (error) {
    console.error('Unexpected search error:', error)
    logSlowQuery('searchArticles (error)', Date.now() - startTime)
    return {
      data: [],
      count: 0,
      error: { message: 'No articles found. Try different search terms.' }
    }
  }
}

export async function getUniqueJournals() {
  const startTime = Date.now()
  const cacheKey = 'unique_journals'
  
  const cached = queryCache.get<string[]>(cacheKey)
  if (cached) {
    logSlowQuery('getUniqueJournals (cached)', Date.now() - startTime)
    return cached
  }

  const supabase = createReadOnlyClient()
  
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
  
  queryCache.set(cacheKey, journals, 3600) // 1 hour
  logSlowQuery('getUniqueJournals', Date.now() - startTime)
  
  return journals as string[]
}

export async function getDistinctEvidenceLevels() {
  const startTime = Date.now()
  const cacheKey = 'evidence_levels'
  
  const cached = queryCache.get<string[]>(cacheKey)
  if (cached) {
    logSlowQuery('getDistinctEvidenceLevels (cached)', Date.now() - startTime)
    return cached
  }

  const supabase = createReadOnlyClient()
  
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
  
  queryCache.set(cacheKey, levels, 3600) // 1 hour
  logSlowQuery('getDistinctEvidenceLevels', Date.now() - startTime)
  
  return levels as string[]
}

// Optimized batch article fetching
export async function getArticlesByIds(ids: string[]) {
  if (ids.length === 0) return []
  
  const startTime = Date.now()
  const batchOps = BatchOperations.getInstance()
  
  try {
    const articles = await batchOps.batchGetArticles(ids)
    logSlowQuery('getArticlesByIds', Date.now() - startTime)
    return articles
  } catch (error) {
    console.error('Error fetching articles by IDs:', error)
    logSlowQuery('getArticlesByIds (error)', Date.now() - startTime)
    return []
  }
}

// Optimized trending articles with batch operations
export async function getTrendingArticleData(daysBack: number = 7) {
  const startTime = Date.now()
  const cacheKey = `trending_articles:${daysBack}`
  
  const cached = queryCache.get<any>(cacheKey)
  if (cached) {
    logSlowQuery('getTrendingArticleData (cached)', Date.now() - startTime)
    return cached
  }

  const supabase = createReadOnlyClient()
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - daysBack)

  // Get save counts in a single optimized query
  const { data: saveCounts, error } = await supabase
    .from('saved_articles')
    .select('article_id')
    .gte('saved_at', daysAgo.toISOString())

  if (error || !saveCounts) {
    logSlowQuery('getTrendingArticleData (error)', Date.now() - startTime)
    return { articles: [], error: error?.message }
  }

  // Count saves per article
  const counts: Record<string, number> = {}
  saveCounts.forEach((item) => {
    counts[item.article_id] = (counts[item.article_id] || 0) + 1
  })

  // Get top article IDs
  const topArticleIds = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id)

  if (topArticleIds.length < 3) {
    const result = { articles: [], error: null }
    queryCache.set(cacheKey, result, 1800) // 30 minutes
    logSlowQuery('getTrendingArticleData', Date.now() - startTime)
    return result
  }

  // Use batch operations to get articles
  const batchOps = BatchOperations.getInstance()
  const articles = await batchOps.batchGetArticles(topArticleIds, supabase)

  const articlesWithSaveCount = articles
    .map((article) => ({
      ...article,
      save_count: counts[article.id] || 0,
    }))
    .sort((a, b) => b.save_count - a.save_count)

  const result = { articles: articlesWithSaveCount, error: null }
  queryCache.set(cacheKey, result, 900) // 15 minutes
  
  logSlowQuery('getTrendingArticleData', Date.now() - startTime)
  return result
}