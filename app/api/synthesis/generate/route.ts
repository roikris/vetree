export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { normalizeQuery, extractKeyLabels } from '@/lib/utils/normalizeQuery'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { query } = body

    if (!query || query.trim().length < 3) {
      return NextResponse.json(
        { error: 'Query must be at least 3 characters' },
        { status: 400 }
      )
    }

    const queryOriginal = query.trim()
    const queryNormalized = normalizeQuery(queryOriginal)

    // Initialize Supabase with service role key
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get current user ID if authenticated
    const { createClient } = await import('@/lib/supabase/server')
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    const userId = user?.id || null

    // Check if feature is enabled
    const { data: flag } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('flag_name', 'topic_synthesis')
      .single()

    if (!flag?.enabled) {
      return NextResponse.json(
        { error: 'Topic synthesis is currently unavailable' },
        { status: 503 }
      )
    }

    // STEP 1: Check cache for existing synthesis
    const { data: cached } = await supabase
      .from('topic_syntheses')
      .select('*')
      .eq('query_normalized', queryNormalized)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cached) {
      // Increment cache hit count
      await supabase
        .from('topic_syntheses')
        .update({
          hit_count: (cached.hit_count || 0) + 1,
          cache_hits: (cached.cache_hits || 0) + 1
        })
        .eq('id', cached.id)

      return NextResponse.json({
        synthesis_html: cached.synthesis_html,
        article_ids: cached.article_ids,
        articles: cached.articles || [], // BUG 2 FIX: Include cached articles
        study_type_breakdown: cached.study_type_breakdown,
        from_cache: true,
        model_used: cached.model_used,
        generation_time_ms: cached.generation_time_ms,
        cache_hits: (cached.cache_hits || 0) + 1
      })
    }

    // STEP 2: Cache miss - fetch articles via FTS and label overlap
    console.log('[synthesis] Cache miss, generating new synthesis for:', queryNormalized)

    const SELECT_FIELDS = 'id, title, clinical_bottom_line, summary, labels, source_journal, publication_date'
    const LARGE_ANIMAL_LABELS = [
      'Equine', 'equine', 'Large Animal', 'large animal',
      'Livestock', 'livestock', 'Poultry', 'poultry',
      'Food Animal', 'food animal',
    ]

    // Tier 1: FTS on title
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

    console.log('[synthesis] ftsArticles:', ftsArticles?.length ?? 0)

    // Tier 2: ILIKE fallback if FTS < 3
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
      console.log('[synthesis] ilikeArticles:', ilikeArticles.length)
    }

    // Tier 3: trigram fuzzy RPC if still < 3
    let fuzzyArticles: any[] = []
    if ((!ftsArticles || ftsArticles.length < 3) && ilikeArticles.length < 3) {
      const fuzzyQuery = queryNormalized.split(' ').slice(0, 3).join(' ')
      const { data: fuzzyIds } = await supabase
        .rpc('search_articles_fuzzy', { search_query: fuzzyQuery, similarity_threshold: 0.2 })
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
      console.log('[synthesis] fuzzyArticles:', fuzzyArticles.length)
    }

    // Label-based search (always runs, merged with tier results)
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
      console.log('[synthesis] labelArticles:', labelArticles.length, 'keyLabels:', keyLabels)
    }

    // Merge and deduplicate
    const allArticles = [...(ftsArticles || []), ...ilikeArticles, ...fuzzyArticles, ...labelArticles]
    const uniqueArticles = Array.from(new Map(allArticles.map(a => [a.id, a])).values())

    const smallAnimalArticles = uniqueArticles.filter(article => {
      const labels = article.labels || []
      return !labels.some((label: string) => LARGE_ANIMAL_LABELS.includes(label))
    })

    console.log('[synthesis] smallAnimalArticles:', smallAnimalArticles.length)

    // Tier 4: broad keyword fallback if still < 3 small-animal articles
    let broadArticles: any[] = []
    if (smallAnimalArticles.length < 3) {
      const stopwords = new Set(['for','and','in','of','the','with','to','a','an','on','at','by','is','are','that','this','or','as','from','canine','feline','dog','cat','patient','patients','update','updates','management','treatment','protocol','protocols'])
      const contentWords = queryOriginal.toLowerCase().split(/\s+/)
        .filter((w: string) => !stopwords.has(w) && w.length > 3)
        .slice(0, 4)
      if (contentWords.length > 0) {
        const orClauses = contentWords.map((w: string) => `clinical_bottom_line.ilike.%${w}%`).join(',')
        const { data } = await supabase
          .from('articles')
          .select(SELECT_FIELDS)
          .or(orClauses)
          .eq('needs_enrichment', false)
          .not('clinical_bottom_line', 'is', null)
          .or('quarantined.is.null,quarantined.eq.false')
          .order('publication_date', { ascending: false })
          .limit(20)
        broadArticles = (data || []).filter(
          (a: any) => !a.labels?.some((l: string) => LARGE_ANIMAL_LABELS.includes(l))
        )
        console.log('[synthesis] broadArticles (tier4):', broadArticles.length, 'contentWords:', contentWords)
      }
    }

    const finalArticles = Array.from(
      new Map([...smallAnimalArticles, ...broadArticles].map(a => [a.id, a])).values()
    )

    // Take top 15 by recency
    const articlesForSynthesis = finalArticles.slice(0, 15)

    if (articlesForSynthesis.length === 0) {
      return NextResponse.json({
        error: 'No articles found for this query',
        synthesis_html: null,
        from_cache: false
      })
    }

    // STEP 3: Build evidence packets for Claude
    const packets = articlesForSynthesis.map((a, i) => ({
      citation_id: i + 1,
      id: a.id,
      title: a.title,
      journal: a.source_journal,
      year: new Date(a.publication_date).getFullYear(),
      clinical_bottom_line: a.clinical_bottom_line,
      labels: a.labels?.join(', ') || 'N/A',
    }))

    // STEP 4: Call Claude to generate synthesis
    // Use Haiku for speed/cost, fallback to Sonnet for large article sets
    const modelToUse = articlesForSynthesis.length > 20
      ? 'claude-sonnet-4-20250514'
      : 'claude-haiku-4-5-20251001'

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    })

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
        content: `TOPIC: "${queryOriginal}"

ARTICLES (${packets.length} studies):
${JSON.stringify(packets, null, 2)}

Synthesize the evidence for this veterinary clinical topic.`
      }]
    })

    const synthesisText = response.content[0].type === 'text' ? response.content[0].text : ''

    // STEP 5: Validate citations
    const citedIds = [...synthesisText.matchAll(/\[(\d+)\]/g)].map(m => parseInt(m[1]))
    const validIds = packets.map(p => p.citation_id)
    const invalidCitations = citedIds.filter(id => !validIds.includes(id))

    if (invalidCitations.length > 0) {
      console.warn('[synthesis] Invalid citations detected:', invalidCitations)
    }

    // STEP 6: Convert [1] citations to clickable links
    const synthesisHtml = synthesisText.replace(
      /\[(\d+)\]/g,
      (match, id) => {
        const article = packets.find(p => p.citation_id === parseInt(id))
        if (!article) return '' // strip invalid citations

        return `<a href="/article/${article.id}" class="citation-link text-[#3D7A5F] dark:text-[#4E9A78] hover:underline font-medium" title="${article.title}">[${id}]</a>`
      }
    )

    // STEP 7: Build study type breakdown
    const studyTypeBreakdown = {
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
      total: articlesForSynthesis.length
    }

    const generationTime = Date.now() - startTime

    // STEP 8: Save to cache
    const { error: insertError } = await supabase
      .from('topic_syntheses')
      .insert({
        query_normalized: queryNormalized,
        query_original: queryOriginal,
        synthesis_html: synthesisHtml,
        article_ids: articlesForSynthesis.map(a => a.id),
        articles: packets, // BUG 2 FIX: Cache article data for display
        article_count: articlesForSynthesis.length,
        study_type_breakdown: studyTypeBreakdown,
        model_used: modelToUse,
        generation_time_ms: generationTime,
        cache_hits: 0,
        user_id: userId
      })

    if (insertError) {
      console.error('[synthesis] Failed to cache synthesis:', insertError)
    }

    return NextResponse.json({
      synthesis_html: synthesisHtml,
      article_ids: articlesForSynthesis.map(a => a.id),
      articles: packets, // BUG 2 FIX: Include article data for frontend display
      study_type_breakdown: studyTypeBreakdown,
      from_cache: false,
      model_used: modelToUse,
      generation_time_ms: generationTime,
      cache_hits: 0
    })

  } catch (error) {
    console.error('[synthesis] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate synthesis',
        details: String(error)
      },
      { status: 500 }
    )
  }
}
