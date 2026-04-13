import Anthropic from '@anthropic-ai/sdk'
import { SupabaseClient } from '@supabase/supabase-js'
import { normalizeQuery, extractKeyLabels } from '@/lib/utils/normalizeQuery'

const LARGE_ANIMAL_LABELS = [
  'Equine', 'equine', 'Large Animal', 'large animal',
  'Livestock', 'livestock', 'Poultry', 'poultry',
  'Food Animal', 'food animal',
]

export interface SynthesisArticlePacket {
  citation_id: number
  id: string
  title: string
  journal: string
  year: number
  clinical_bottom_line: string
  labels: string
}

export interface StudyTypeBreakdown {
  systematic_reviews: number
  rct: number
  retrospective: number
  case_reports: number
  total: number
}

export interface SynthesisResult {
  id: string
  synthesis_html: string
  articles: SynthesisArticlePacket[]
  article_count: number
  study_type_breakdown: StudyTypeBreakdown
  from_cache: boolean
}

/**
 * Fetches a synthesis from cache, or generates + caches a new one.
 * Used by both /api/synthesis/generate and /api/growth/generate-synthesis-post
 * to avoid internal HTTP calls.
 */
export async function fetchOrGenerateSynthesis(
  supabase: SupabaseClient,
  query: string,
): Promise<SynthesisResult | null> {
  const queryOriginal = query.trim()
  const queryNormalized = normalizeQuery(queryOriginal)

  // Check cache first
  const { data: cached } = await supabase
    .from('topic_syntheses')
    .select('*')
    .eq('query_normalized', queryNormalized)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (cached) {
    return {
      id: cached.id,
      synthesis_html: cached.synthesis_html,
      articles: cached.articles || [],
      article_count: cached.article_count || 0,
      study_type_breakdown: cached.study_type_breakdown || {
        systematic_reviews: 0, rct: 0, retrospective: 0, case_reports: 0, total: 0,
      },
      from_cache: true,
    }
  }

  // Cache miss — fetch articles and generate
  const startTime = Date.now()
  const SELECT_FIELDS = 'id, title, clinical_bottom_line, summary, labels, source_journal, publication_date'

  // Tier 1: FTS on title using first 4 normalized keywords
  const ftsQuery = queryNormalized.split(' ').slice(0, 4).join(' ')
  const { data: ftsArticles } = await supabase
    .from('articles')
    .select(SELECT_FIELDS)
    .textSearch('title', ftsQuery, { type: 'websearch' })
    .eq('needs_enrichment', false)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')
    .order('publication_date', { ascending: false })
    .limit(40)

  // Tier 2: ILIKE fallback if FTS returned < 3 results
  let ilikeArticles: any[] = []
  if (!ftsArticles || ftsArticles.length < 3) {
    const shortQuery = queryNormalized.split(' ').slice(0, 3).join(' ')
    const { data } = await supabase
      .from('articles')
      .select(SELECT_FIELDS)
      .or(`title.ilike.%${shortQuery}%,clinical_bottom_line.ilike.%${shortQuery}%`)
      .eq('needs_enrichment', false)
      .not('clinical_bottom_line', 'is', null)
      .or('quarantined.is.null,quarantined.eq.false')
      .order('publication_date', { ascending: false })
      .limit(40)
    ilikeArticles = data || []
  }

  // Tier 3: trigram fuzzy RPC if still < 3
  let fuzzyArticles: any[] = []
  if ((!ftsArticles || ftsArticles.length < 3) && ilikeArticles.length < 3) {
    const fuzzyQuery = queryNormalized.split(' ').slice(0, 3).join(' ')
    const { data: fuzzyIds } = await supabase
      .rpc('search_articles_fuzzy', {
        search_query: fuzzyQuery,
        similarity_threshold: 0.2,
      })
    if (fuzzyIds && fuzzyIds.length > 0) {
      const { data } = await supabase
        .from('articles')
        .select(SELECT_FIELDS)
        .in('id', fuzzyIds.map((a: any) => a.id))
        .eq('needs_enrichment', false)
        .not('clinical_bottom_line', 'is', null)
        .or('quarantined.is.null,quarantined.eq.false')
        .order('publication_date', { ascending: false })
        .limit(40)
      fuzzyArticles = data || []
    }
  }

  // Label overlap — merged with tier results
  const keyLabels = extractKeyLabels(queryOriginal)
  let labelArticles: any[] = []
  if (keyLabels.length > 0) {
    const { data } = await supabase
      .from('articles')
      .select(SELECT_FIELDS)
      .overlaps('labels', keyLabels)
      .eq('needs_enrichment', false)
      .not('clinical_bottom_line', 'is', null)
      .or('quarantined.is.null,quarantined.eq.false')
      .order('publication_date', { ascending: false })
      .limit(20)
    labelArticles = data || []
  }

  const allArticles = [
    ...(ftsArticles || []),
    ...ilikeArticles,
    ...fuzzyArticles,
    ...labelArticles,
  ]
  const uniqueArticles = Array.from(new Map(allArticles.map(a => [a.id, a])).values())
  const smallAnimalArticles = uniqueArticles.filter(
    a => !a.labels?.some((l: string) => LARGE_ANIMAL_LABELS.includes(l))
  )

  // Tier 4: keyword-in-label fallback if still < 3 small-animal articles
  let broadLabelArticles: any[] = []
  if (smallAnimalArticles.length < 3) {
    const stopwords = new Set(['for','and','in','of','the','with','to','a','an','on','at','by','is','are','that','this','or','as','from','canine','feline','dog','cat','patient','patients','update','updates','management','treatment','protocol','protocols'])
    const contentWords = queryOriginal.toLowerCase().split(/\s+/)
      .filter(w => !stopwords.has(w) && w.length > 3)
      .slice(0, 4)

    if (contentWords.length > 0) {
      const orClauses = contentWords.map(w => `clinical_bottom_line.ilike.%${w}%`).join(',')
      const { data } = await supabase
        .from('articles')
        .select(SELECT_FIELDS)
        .or(orClauses)
        .eq('needs_enrichment', false)
        .not('clinical_bottom_line', 'is', null)
        .or('quarantined.is.null,quarantined.eq.false')
        .order('publication_date', { ascending: false })
        .limit(20)
      broadLabelArticles = (data || []).filter(
        (a: any) => !a.labels?.some((l: string) => LARGE_ANIMAL_LABELS.includes(l))
      )
    }
  }

  const allWithBroad = [...smallAnimalArticles, ...broadLabelArticles]
  const finalArticles = Array.from(new Map(allWithBroad.map(a => [a.id, a])).values())
  const articlesForSynthesis = finalArticles.slice(0, 15)

  if (articlesForSynthesis.length === 0) return null

  const packets: SynthesisArticlePacket[] = articlesForSynthesis.map((a, i) => ({
    citation_id: i + 1,
    id: a.id,
    title: a.title,
    journal: a.source_journal,
    year: new Date(a.publication_date).getFullYear(),
    clinical_bottom_line: a.clinical_bottom_line,
    labels: a.labels?.join(', ') || 'N/A',
  }))

  const modelToUse = articlesForSynthesis.length > 20
    ? 'claude-sonnet-4-20250514'
    : 'claude-haiku-4-5-20251001'

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const response = await anthropic.messages.create({
    model: modelToUse,
    max_tokens: 1500,
    system: `You are a veterinary evidence synthesis system.
Your task is to synthesize research findings for veterinary professionals.

STRICT RULES:
- Only use the provided articles. No outside knowledge.
- Every factual claim MUST be cited using [citation_id] format.
- If studies conflict, explicitly state the conflict with "⚠️ Conflicting evidence:" prefix.
- Never hallucinate citations — only cite IDs from the provided list.
- If evidence is weak or limited, say so clearly.
- Separate findings for dogs vs cats when relevant.

OUTPUT FORMAT (use exactly this structure):
## Clinical Consensus
[2-3 sentences summarizing main agreement across studies, with citations]

## Key Findings
[Bullet points of specific findings with citations]

## Dogs vs Cats
[Species-specific differences if relevant, or "No species-specific data available"]

## Complication Rates / Outcomes
[Specific numbers when available, with citations]

## Evidence Gaps
[What's unknown or where studies are limited]

## Evidence Quality
[Summarize: X systematic reviews, Y retrospective studies, Z case reports]`,
    messages: [{
      role: 'user',
      content: `TOPIC: "${queryOriginal}"\n\nARTICLES (${packets.length} studies):\n${JSON.stringify(packets, null, 2)}\n\nSynthesize the evidence for this veterinary clinical topic.`,
    }],
  })

  const synthesisText = response.content[0].type === 'text' ? response.content[0].text : ''

  const synthesisHtml = synthesisText.replace(/\[(\d+)\]/g, (_, id) => {
    const article = packets.find(p => p.citation_id === parseInt(id))
    if (!article) return ''
    return `<a href="/article/${article.id}" class="citation-link text-[#3D7A5F] dark:text-[#4E9A78] hover:underline font-medium" title="${article.title}">[${id}]</a>`
  })

  const studyTypeBreakdown: StudyTypeBreakdown = {
    systematic_reviews: articlesForSynthesis.filter(a =>
      a.labels?.some((l: string) => l.toLowerCase().includes('systematic review'))
    ).length,
    rct: articlesForSynthesis.filter(a =>
      a.labels?.some((l: string) => l.toLowerCase().includes('rct') || l.toLowerCase().includes('randomized'))
    ).length,
    retrospective: articlesForSynthesis.filter(a =>
      a.labels?.some((l: string) => l.toLowerCase().includes('retrospective'))
    ).length,
    case_reports: articlesForSynthesis.filter(a =>
      a.labels?.some((l: string) => l.toLowerCase().includes('case report'))
    ).length,
    total: articlesForSynthesis.length,
  }

  const generationTime = Date.now() - startTime

  const { data: inserted } = await supabase
    .from('topic_syntheses')
    .insert({
      query_normalized: queryNormalized,
      query_original: queryOriginal,
      synthesis_html: synthesisHtml,
      article_ids: articlesForSynthesis.map(a => a.id),
      articles: packets,
      article_count: articlesForSynthesis.length,
      study_type_breakdown: studyTypeBreakdown,
      model_used: modelToUse,
      generation_time_ms: generationTime,
      cache_hits: 0,
      user_id: null,
    })
    .select('id')
    .single()

  return {
    id: inserted?.id || '',
    synthesis_html: synthesisHtml,
    articles: packets,
    article_count: articlesForSynthesis.length,
    study_type_breakdown: studyTypeBreakdown,
    from_cache: false,
  }
}
