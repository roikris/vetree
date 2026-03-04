import { supabase } from '@/lib/supabase'
import { ParsedFilters } from '@/types/search'

// Sanitize search terms to prevent PostgREST query parsing errors
function sanitizeSearchTerm(term: string): string {
  // Remove special characters that break PostgREST parsing: ( ) , . % _ [ ] * ? \
  // Replace with spaces and trim
  return term.replace(/[(),.%_[\]*?\\]/g, ' ').trim()
}

export async function searchArticles(filters: ParsedFilters, pageSize = 20) {
  try {
    let query = supabase.from('articles').select('*', { count: 'exact' })

    // Search across multiple fields with OR
    if (filters.search) {
      const sanitizedSearch = sanitizeSearchTerm(filters.search)

      // Skip search if sanitized term is empty
      if (!sanitizedSearch) {
        return {
          data: [],
          count: 0,
          error: { message: 'No articles found. Try different search terms.' }
        }
      }

      query = query.or(
        `title.ilike.%${sanitizedSearch}%,summary.ilike.%${sanitizedSearch}%,clinical_bottom_line.ilike.%${sanitizedSearch}%,authors.ilike.%${sanitizedSearch}%`
      )
    }

  // Quick filter (Small Animal or Large Animal)
  if (filters.quickFilter !== 'all') {
    const quickLabel = filters.quickFilter === 'small-animal' ? 'Small Animal' : 'Large Animal'
    // Use overlaps to check if the array contains this label
    query = query.overlaps('labels', [quickLabel])
  }

  // Filter by labels (specialty checkboxes)
  if (filters.labels.length > 0) {
    if (filters.labelOperator === 'AND') {
      // AND: article must have ALL selected labels
      query = query.contains('labels', filters.labels)
    } else {
      // OR: article must have AT LEAST ONE of the selected labels
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
        error: { message: 'No articles found. Try different search terms.' }
      }
    }

    return result
  } catch (error) {
    // Catch any unexpected errors and return a friendly message
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

  if (!data) return []

  const journals = [...new Set(data.map(d => d.source_journal))].sort()
  return journals as string[]
}

export async function getDistinctEvidenceLevels() {
  const { data } = await supabase
    .from('articles')
    .select('strength_of_evidence')
    .not('strength_of_evidence', 'is', null)

  if (!data) return []

  const levels = [...new Set(data.map(d => d.strength_of_evidence))].sort()
  return levels as string[]
}
