import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// These are species modifiers, not clinical specialties — exclude from grove nodes
const EXCLUDE_LABELS = new Set([
  'Small Animal', 'Large Animal', 'large animal', 'Large animal',
  'Equine', 'equine', 'Livestock', 'livestock',
  'Poultry', 'poultry', 'Food Animal', 'food animal',
])

export async function GET() {
  const supabase = await createClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: recent } = await supabase
    .from('articles')
    .select('id, labels, clinical_bottom_line, strength_of_evidence, source_journal')
    .eq('needs_enrichment', false)
    .not('clinical_bottom_line', 'is', null)
    .gte('publication_date', sevenDaysAgo)
    .limit(400)

  // Aggregate by specialty
  const specMap: Record<string, {
    count: number
    coLabels: Record<string, number>
    articles: { id: string; clinical_bottom_line: string; strength_of_evidence: string | null; source_journal: string | null }[]
  }> = {}

  for (const article of recent || []) {
    const labels = ((article.labels as string[]) || []).filter(l => !EXCLUDE_LABELS.has(l))
    for (const label of labels) {
      if (!specMap[label]) specMap[label] = { count: 0, coLabels: {}, articles: [] }
      specMap[label].count++
      for (const other of labels) {
        if (other !== label) {
          specMap[label].coLabels[other] = (specMap[label].coLabels[other] || 0) + 1
        }
      }
      if (specMap[label].articles.length < 6) {
        specMap[label].articles.push({
          id: article.id,
          clinical_bottom_line: article.clinical_bottom_line,
          strength_of_evidence: article.strength_of_evidence,
          source_journal: article.source_journal,
        })
      }
    }
  }

  // Top 6 specialties by recent article count
  const top6 = Object.entries(specMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([name, data]) => ({
      name,
      count: data.count,
      connects: Object.entries(data.coLabels)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([n]) => n),
      articles: data.articles,
    }))

  return NextResponse.json(top6)
}
