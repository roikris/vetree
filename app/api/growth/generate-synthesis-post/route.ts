export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ratelimitModerate, getClientIP } from '@/lib/ratelimit'
import {
  fetchOrGenerateSynthesis,
  SynthesisArticlePacket,
  StudyTypeBreakdown,
} from '@/lib/synthesis/generateSynthesis'
import Anthropic from '@anthropic-ai/sdk'

type FormatKey = 'evidence_report' | 'clinical_insight' | 'myth_vs_evidence'

async function generateFormat(
  anthropic: Anthropic,
  formatKey: FormatKey,
  topic: string,
  synthesisData: {
    synthesis_html: string
    articles: SynthesisArticlePacket[]
    article_count: number
    study_type_breakdown: StudyTypeBreakdown
  },
): Promise<string> {
  const { synthesis_html, articles, article_count, study_type_breakdown } = synthesisData
  const citationsList = articles
    .map((a, i) => `[${i + 1}] ${a.title} (${a.journal}, ${a.year})`)
    .join('\n')
  const qualityLine = `${study_type_breakdown.rct} RCTs · ${study_type_breakdown.retrospective} retrospective · ${study_type_breakdown.case_reports} case reports`
  const topicSlug = topic.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  let prompt = ''

  if (formatKey === 'evidence_report') {
    prompt = `You are writing a LinkedIn post for Vetree, an evidence-based veterinary platform.

Topic: ${topic}
Based on: ${article_count} peer-reviewed studies
Citations available:
${citationsList}
Synthesis findings:
${synthesis_html}

Write a LinkedIn post in "Evidence Report" style:
- Open with: "🔬 What does the research actually say about [topic]?"
- Line 2: "I analyzed [N] peer-reviewed studies. Here's what the evidence shows:"
- 5-7 numbered findings, each 1-2 sentences, specific and clinical
- Each finding references study count or type (e.g., "across 4 RCTs...")
- Section: "⚠️ Where studies disagree:" (if applicable)
- Section: "📊 Evidence quality: ${qualityLine}"
- End: "Full evidence summary → vetree.app/synthesis/${topicSlug}"
- 200-300 words total
- LinkedIn rhythm: short→long→short paragraphs
- BANNED: "game changer", "revolutionary", "excited to share"
- Return ONLY the post text`
  } else if (formatKey === 'clinical_insight') {
    prompt = `You are writing a LinkedIn post for Vetree, an evidence-based veterinary platform.

Topic: ${topic}
Based on: ${article_count} peer-reviewed studies
Synthesis findings:
${synthesis_html}

Write a LinkedIn post in "Clinical Insight" style:
- Open with a statement about how most vets approach this topic
- "Here's what [N] studies actually found:"
- Narrative synthesis — 3-4 paragraphs weaving in findings naturally
- End with: "The bottom line for your practice:" + one actionable sentence
- End: "→ Full evidence summary at vetree.app"
- 200-300 words
- Conversational but evidence-backed
- BANNED: "game changer", "revolutionary", "excited to share", "groundbreaking"
- Return ONLY the post text`
  } else {
    prompt = `You are writing a LinkedIn post for Vetree, an evidence-based veterinary platform.

Topic: ${topic}
Based on: ${article_count} peer-reviewed studies
Synthesis findings:
${synthesis_html}

Write a LinkedIn post in "Myth vs Evidence" style:
- Open with: "Common belief: [what most vets assume about this topic]"
- "What [N] studies actually show: [surprising or nuanced finding]"
- 3-5 key findings that challenge or nuance conventional wisdom
- Evidence quality note: "${qualityLine}"
- End: "→ vetree.app"
- 150-250 words
- Bold and direct tone
- BANNED: "game changer", "revolutionary", "excited to share"
- Return ONLY the post text`
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: 'You are a veterinary content writer. Write specific, clinically relevant LinkedIn posts for DVMs in small animal practice.',
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIP(request)
    const { success } = await ratelimitModerate.limit(ip)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    // Admin auth check
    const serverClient = await createClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: role } = await serverClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Check feature flag
    const { data: flag } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('flag_name', 'topic_synthesis')
      .single()
    if (!flag?.enabled) {
      return NextResponse.json({ error: 'Topic synthesis is currently unavailable' }, { status: 503 })
    }

    const body = await request.json()
    const { topic, synthesis_id } = body

    if (!topic?.trim()) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
    }

    // Get synthesis data — by ID if provided, otherwise fetch/generate by topic
    let synthesisData: {
      id: string
      synthesis_html: string
      articles: SynthesisArticlePacket[]
      article_count: number
      study_type_breakdown: StudyTypeBreakdown
    } | null = null

    if (synthesis_id) {
      const { data: cached } = await supabase
        .from('topic_syntheses')
        .select('*')
        .eq('id', synthesis_id)
        .single()
      if (cached) {
        synthesisData = {
          id: cached.id,
          synthesis_html: cached.synthesis_html,
          articles: cached.articles || [],
          article_count: cached.article_count || 0,
          study_type_breakdown: cached.study_type_breakdown || {
            systematic_reviews: 0, rct: 0, retrospective: 0, case_reports: 0, total: 0,
          },
        }
      }
    }

    if (!synthesisData) {
      synthesisData = await fetchOrGenerateSynthesis(supabase, topic)
    }

    if (!synthesisData) {
      return NextResponse.json(
        { error: 'No articles found for this topic. Try a different search term.' },
        { status: 500 },
      )
    }

    // Generate all 3 formats in parallel using Claude Haiku
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const [evidenceReport, clinicalInsight, mythVsEvidence] = await Promise.all([
      generateFormat(anthropic, 'evidence_report', topic, synthesisData),
      generateFormat(anthropic, 'clinical_insight', topic, synthesisData),
      generateFormat(anthropic, 'myth_vs_evidence', topic, synthesisData),
    ])

    return NextResponse.json({
      topic,
      synthesis_id: synthesisData.id,
      article_count: synthesisData.article_count,
      study_type_breakdown: synthesisData.study_type_breakdown,
      formats: {
        evidence_report: { content: evidenceReport, label: 'Evidence Report' },
        clinical_insight: { content: clinicalInsight, label: 'Clinical Insight' },
        myth_vs_evidence: { content: mythVsEvidence, label: 'Myth vs Evidence' },
      },
    })
  } catch (error) {
    console.error('[generate-synthesis-post] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate synthesis post', details: String(error) },
      { status: 500 },
    )
  }
}
