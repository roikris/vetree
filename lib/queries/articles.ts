import { supabase } from '@/lib/supabase'
import { ParsedFilters } from '@/types/search'

export async function searchArticles(filters: ParsedFilters, pageSize = 20) {
  let query = supabase.from('articles').select('*', { count: 'exact' })

  // Search across multiple fields with OR
  if (filters.search) {
    const search = filters.search
    query = query.or(
      `title.ilike.%${search}%,summary.ilike.%${search}%,clinical_bottom_line.ilike.%${search}%,authors.ilike.%${search}%`
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

  return query
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
