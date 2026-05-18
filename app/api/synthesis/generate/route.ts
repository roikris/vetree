export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { normalizeQuery } from '@/lib/utils/normalizeQuery'

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

    // STEP 1: Check cache for existing synthesis (search_version >= 2 = new ranked search only)
    const { data: cached } = await supabase
      .from('topic_syntheses')
      .select('*')
      .eq('query_normalized', queryNormalized)
      .gt('expires_at', new Date().toISOString())
      .gte('search_version', 2)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cached) {
      const articlesInCache = cached.articles as any[]
      if (!articlesInCache || articlesInCache.length < 5) {
        // Cache entry from broken search period — ignore and regenerate
        console.log('[synthesis] Cache invalid (too few articles), regenerating')
      } else {
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
          articles: cached.articles || [],
          study_type_breakdown: cached.study_type_breakdown,
          from_cache: true,
          model_used: cached.model_used,
          generation_time_ms: cached.generation_time_ms,
          cache_hits: (cached.cache_hits || 0) + 1
        })
      }
    }

    // STEP 2: Cache miss — fetch articles with ranked synthesis RPC
    console.log('[synthesis] Cache miss, generating new synthesis for:', queryOriginal)

    const LARGE_ANIMAL_LABELS = [
      'Equine', 'equine', 'Large Animal', 'large animal',
      'Livestock', 'livestock', 'Poultry', 'poultry',
      'Food Animal', 'food animal',
    ]

    const { data: rpcArticles, error: rpcError } = await supabase
      .rpc('search_articles_synthesis', {
        search_query: queryNormalized,
        candidate_limit: 50,
        final_limit: 15
      })

    if (rpcError) {
      console.error('[synthesis] RPC error:', rpcError)
    }

    // Large animal filter in JS (per CLAUDE.md)
    const articlesForSynthesis = (rpcArticles || []).filter((a: any) =>
      !a.labels?.some((l: string) => LARGE_ANIMAL_LABELS.includes(l))
    )

    console.log('[synthesis] articlesForSynthesis:', articlesForSynthesis.length)

    if (articlesForSynthesis.length < 3) {
      return NextResponse.json({
        synthesis_html: null,
        articles: articlesForSynthesis,
        insufficient: true,
        message: `Only ${articlesForSynthesis.length} relevant ${articlesForSynthesis.length === 1 ? 'study' : 'studies'} found on this topic. Try a broader search term for synthesis.`
      })
    }

    // STEP 3: Build evidence packets for Claude
    const packets = articlesForSynthesis.map((a: any, i: number) => ({
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
- If fewer than 5 articles are available, synthesize what exists and note the limited evidence base. Do not refuse to synthesize.

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
    const validIds = packets.map((p: any) => p.citation_id)
    const invalidCitations = citedIds.filter(id => !validIds.includes(id))

    if (invalidCitations.length > 0) {
      console.warn('[synthesis] Invalid citations detected:', invalidCitations)
    }

    // STEP 6: Convert [1] citations to clickable links
    const synthesisHtml = synthesisText.replace(
      /\[(\d+)\]/g,
      (match, id) => {
        const article = packets.find((p: any) => p.citation_id === parseInt(id))
        if (!article) return '' // strip invalid citations

        return `<a href="/article/${article.id}" class="citation-link text-[#3D7A5F] dark:text-[#4E9A78] hover:underline font-medium" title="${article.title}">[${id}]</a>`
      }
    )

    // STEP 7: Build study type breakdown
    const studyTypeBreakdown = {
      systematic_reviews: articlesForSynthesis.filter((a: any) =>
        a.labels?.some((l: string) => l.toLowerCase().includes('systematic review'))
      ).length,
      rct: articlesForSynthesis.filter((a: any) =>
        a.labels?.some((l: string) => l.toLowerCase().includes('rct') || l.toLowerCase().includes('randomized'))
      ).length,
      retrospective: articlesForSynthesis.filter((a: any) =>
        a.labels?.some((l: string) => l.toLowerCase().includes('retrospective'))
      ).length,
      case_reports: articlesForSynthesis.filter((a: any) =>
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
        article_ids: articlesForSynthesis.map((a: any) => a.id),
        articles: packets, // BUG 2 FIX: Cache article data for display
        article_count: articlesForSynthesis.length,
        study_type_breakdown: studyTypeBreakdown,
        model_used: modelToUse,
        generation_time_ms: generationTime,
        cache_hits: 0,
        user_id: userId,
        search_version: 2
      })

    if (insertError) {
      console.error('[synthesis] Failed to cache synthesis:', insertError)
    }

    return NextResponse.json({
      synthesis_html: synthesisHtml,
      article_ids: articlesForSynthesis.map((a: any) => a.id),
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
