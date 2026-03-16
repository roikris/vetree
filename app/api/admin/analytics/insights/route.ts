export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Claude Sonnet can take 15-30 seconds

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    console.log('[insights] Starting analysis generation...')

    // Verify authorization - allow both Bearer token (for cron) and admin user (for UI)
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    let isAuthorized = false

    // Check Bearer token first (for cron job)
    if (token === process.env.DIGEST_SECRET) {
      isAuthorized = true
      console.log('[insights] Authorized via Bearer token')
    } else {
      // Check admin user (for UI)
      try {
        const { createClient: createServerClient } = await import('@/lib/supabase/server')
        const userSupabase = await createServerClient()
        const { data: { user } } = await userSupabase.auth.getUser()

        if (user) {
          const { data: roleData } = await userSupabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

          if (roleData?.role === 'admin') {
            isAuthorized = true
            console.log('[insights] Authorized via admin user')
          }
        }
      } catch (authError) {
        console.error('[insights] Auth check error:', authError)
      }
    }

    if (!isAuthorized) {
      console.log('[insights] Authorization failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[insights] Initializing Supabase and Anthropic clients...')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Load top signals (sorted by severity)
    console.log('[insights] Loading signals...')
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: signals, error: signalsError } = await supabase
      .from('analytics_signals')
      .select('*')
      .gte('date', sevenDaysAgo)
      .order('severity', { ascending: false })
      .limit(15)

    if (signalsError) {
      console.error('[insights] Signals fetch failed:', signalsError)
      throw new Error(`Signals fetch failed: ${signalsError.message}`)
    }
    console.log('[insights] Signals loaded:', signals?.length || 0)

    // Load latest snapshot
    console.log('[insights] Loading snapshot...')
    const { data: snapshot, error: snapshotError } = await supabase
      .from('analytics_daily_snapshot')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (snapshotError && snapshotError.code !== 'PGRST116') {
      console.error('[insights] Snapshot fetch failed:', snapshotError)
      throw new Error(`Snapshot fetch failed: ${snapshotError.message}`)
    }
    console.log('[insights] Snapshot loaded:', snapshot?.date || 'none')

    // Load past insights to avoid repetition (last 3 runs)
    console.log('[insights] Loading past insights...')
    const { data: pastInsights, error: pastInsightsError } = await supabase
      .from('analytics_insights')
      .select('insights_json, top_3_actions')
      .order('generated_at', { ascending: false })
      .limit(3)

    if (pastInsightsError) {
      console.error('[insights] Past insights fetch failed:', pastInsightsError)
      // Non-critical, continue
    }
    console.log('[insights] Past insights loaded:', pastInsights?.length || 0)

    const pastActionsText = pastInsights?.flatMap(i =>
      (i.top_3_actions as string[]) || []
    ).slice(0, 10).join('\n- ') || 'None yet'

    const systemPrompt = `You are the Lead Product Analyst for Vetree, an evidence-based veterinary research platform built for DVMs (veterinarians).

PLATFORM CONTEXT:
- ~15 active users, early stage
- Articles sourced from PubMed, enriched with AI clinical summaries
- Features: search, article synthesis, weekly email digest, follow tags
- Goal: become the go-to research tool for practicing vets

CRITICAL BIAS WARNING:
Article view counts are NOT reliable signals — they reflect social media promotion, not clinical usefulness.
Use saves, synthesis runs, and search demand as primary quality signals.

YOUR PRIORITIES (in order):
1. Retention — what keeps vets coming back?
2. Content gaps — what are vets searching for that we don't have?
3. UX problems — what friction exists?
4. Growth opportunities — what's working that we can amplify?

RULES:
- Every insight MUST cite specific numbers from the signals
- Every recommendation must be executable within 1 week by a solo developer
- Ignore fluctuations under 10% or signals with n < 3
- Do NOT give generic SaaS advice
- Veterinary clinical relevance > engagement metrics
- Return ONLY valid JSON, no markdown, no preamble`

    const userPrompt = `Analyze these signals from the past 7 days and generate actionable insights.

METRICS SNAPSHOT:
${JSON.stringify(snapshot, null, 2)}

TOP SIGNALS (sorted by severity):
${JSON.stringify(signals, null, 2)}

PREVIOUS RECOMMENDATIONS (avoid repeating these):
- ${pastActionsText}

Return this exact JSON structure:
{
  "insights": [
    {
      "area": "content|ux|growth|retention|feature",
      "observation": "specific pattern with exact numbers",
      "why_it_matters": "clinical or business relevance for DVMs",
      "recommendation": "specific executable action",
      "time_to_implement": "1h|half-day|1-day|1-week",
      "impact": "low|medium|high",
      "confidence": 0.0
    }
  ],
  "top_3_actions": ["action 1", "action 2", "action 3"],
  "content_roadmap": ["synthesis topic 1", "synthesis topic 2", "synthesis topic 3"],
  "churn_risks": ["description of churn risk if any"],
  "weekly_summary": "2-3 sentence summary for Slack notification"
}

Generate 4-6 insights maximum. Quality over quantity.`

    console.log('[insights] Calling Claude Sonnet for analysis...')
    console.log('[insights] Prompt length:', userPrompt.length, 'chars')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt
    })

    console.log('[insights] Claude response received, tokens:', response.usage.input_tokens, 'in /', response.usage.output_tokens, 'out')

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    console.log('[insights] Raw response preview:', rawText.slice(0, 200))

    // Strip markdown code fences if present
    const cleanText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    let insightsData
    try {
      insightsData = JSON.parse(cleanText)
      console.log('[insights] JSON parsed successfully, insights count:', insightsData.insights?.length || 0)
    } catch (parseError) {
      console.error('[insights] JSON parse failed:', parseError)
      console.error('[insights] Raw text was:', rawText)
      console.error('[insights] Clean text was:', cleanText)
      throw new Error(`Failed to parse Claude response: ${parseError}`)
    }

    // Run critique pass
    console.log('[insights] Running critique pass...')
    const critiquePrompt = `Review these insights for quality. For each insight, check:
1. Is it backed by specific numbers?
2. Is the recommendation concrete and executable this week?
3. Is it relevant for veterinarians (not generic SaaS advice)?
4. Score each 0-1 for quality.

Remove insights scoring below 0.6 and return the filtered list in the same JSON format.

Insights to review:
${JSON.stringify(insightsData, null, 2)}`

    const critiqueResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: critiquePrompt }],
      system: 'You are a quality checker for product insights. Return only valid JSON matching the input format, with low-quality insights removed.'
    })

    console.log('[insights] Critique response received, tokens:', critiqueResponse.usage.input_tokens, 'in /', critiqueResponse.usage.output_tokens, 'out')

    const critiqueRaw = critiqueResponse.content[0].type === 'text'
      ? critiqueResponse.content[0].text
      : rawText

    // Strip markdown code fences (Haiku sometimes wraps JSON in ```json ... ```)
    const cleanCritique = critiqueRaw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    let finalInsights
    try {
      finalInsights = JSON.parse(cleanCritique)
      console.log('[insights] Critique parsed successfully, final insights:', finalInsights.insights?.length || 0)
    } catch (critiqueParseError) {
      console.error('[insights] Critique parse failed, using original:', critiqueParseError)
      console.error('[insights] Attempted to parse:', cleanCritique.slice(0, 200))
      finalInsights = insightsData // fallback to uncritiqued if parse fails
    }

    // Save to DB
    console.log('[insights] Saving to database...')
    const runId = `analysis_${Date.now()}`
    const { error: insertError } = await supabase.from('analytics_insights').insert({
      run_id: runId,
      insights_json: finalInsights.insights,
      top_3_actions: finalInsights.top_3_actions,
      content_roadmap: finalInsights.content_roadmap,
      churn_risks: finalInsights.churn_risks,
      model_used: 'claude-sonnet-4-20250514',
      tokens_used: response.usage.input_tokens + response.usage.output_tokens
    })

    if (insertError) {
      console.error('[insights] Database insert error:', insertError)
      throw new Error(`Database insert failed: ${insertError.message}`)
    }
    console.log('[insights] Saved to database successfully, run_id:', runId)

    // Send to Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      console.log('[insights] Sending Slack notification...')
      const slackMessage = {
        text: `🧠 *Vetree Weekly Analysis*\n\n${finalInsights.weekly_summary}\n\n*TOP 3 ACTIONS:*\n${finalInsights.top_3_actions.map((a: string, i: number) => `${i+1}. ${a}`).join('\n')}\n\n*CONTENT ROADMAP:*\n${finalInsights.content_roadmap.map((t: string) => `• ${t}`).join('\n')}\n\n<https://vetree.app/admin/analytics|View Full Report →>`
      }

      try {
        const slackResponse = await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage)
        })

        if (!slackResponse.ok) {
          console.error('[insights] Slack response not ok:', slackResponse.status, slackResponse.statusText)
        } else {
          console.log('[insights] Slack notification sent successfully')
        }
      } catch (slackError) {
        console.error('[insights] Slack error:', slackError)
        // Non-critical, continue
      }
    } else {
      console.log('[insights] No Slack webhook configured, skipping notification')
    }

    console.log('[insights] Analysis generation complete!')
    return NextResponse.json({ success: true, run_id: runId, insights: finalInsights })

  } catch (error) {
    console.error('[insights] FATAL ERROR:', error)
    console.error('[insights] Error stack:', error instanceof Error ? error.stack : 'no stack')
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
