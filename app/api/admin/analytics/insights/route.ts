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

PLATFORM CONTEXT — what already exists (do NOT suggest these):
- Hero section with CTA and "New!" synthesis banner on homepage
- Soft registration wall after 3 article views
- Weekly email digest (Fridays) with tag-based personalization
- Follow tags system with "For You" personalized feed
- Topic Synthesis: AI evidence synthesis from multiple papers with citations
- Full-text search with fuzzy matching (pg_trgm) and spelling correction
- Article pages with evidence badges, clinical bottom line, save button
- Mobile-optimized UI with bottom navigation
- PWA support with install prompt
- Growth OS: AI-generated social posts for 9 platforms daily
- Analysis Agent (this system) running weekly
- User retention analytics dashboard (DAU/WAU/MAU, churn detection)
- "Related articles" suggestions on article pages
- Re-engagement section in digest for at-risk users

TECH STACK (important for recommendations):
- Next.js App Router on Vercel
- Supabase (PostgreSQL + Auth + RLS)
- Claude Haiku/Sonnet for AI features
- Upstash Redis for rate limiting
- Resend for email
- Solo developer — 1 person builds everything

KNOWN CONSTRAINTS:
- Solo developer: recommendations must be achievable in 1 day max
- No budget for external services unless free tier
- Article views are unreliable (social promotion bias) — use saves/search/synthesis instead
- ~15 registered users, early stage

WHAT GOOD RECOMMENDATIONS LOOK LIKE:
Good: "52% zero-result searches — add these 5 specific missing topics to the search synonym map in lib/utils/normalizeQuery.ts"
Good: "3 users haven't returned in 7 days — trigger re-engagement section in their next Friday digest automatically"
Good: "LinkedIn traffic has 3x session duration — generate more LinkedIn posts in the Content Agent rotation"

Bad: "Create a landing page" (already have hero section)
Bad: "Add a search feature" (already have fuzzy search)
Bad: "Send email notifications" (already have weekly digest)
Bad: "Add related content" (already have related articles)
Bad: "Improve mobile experience" (already mobile-optimized)

YOUR PRIORITIES (in order):
1. Retention — what specific friction prevents vets from returning?
2. Content gaps — which exact search queries have no results?
3. Growth — which platforms/channels are converting best?
4. Feature depth — which existing features are underused and why?

RULES:
- Every insight MUST cite specific numbers from the signals
- Every recommendation must reference a specific file, feature, or existing system to modify — not build from scratch
- Achievable by a solo developer in under 1 day
- Veterinary clinical relevance > generic SaaS patterns
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

Generate 4-6 insights maximum. Quality over quantity.

CONTENT ROADMAP RULE: Always populate content_roadmap with 3-5 specific veterinary topics.
Source priority: (1) signals with type=content_opportunity and results=0 (zero-result queries), (2) signals with type=content_opportunity and results=low (<10) — thin content areas, (3) if no content_opportunity signals exist, derive topics from top_searches in the snapshot that likely have sparse coverage. Never return an empty content_roadmap array.`

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

    // Generate full metrics report
    console.log('[insights] Generating full metrics report...')
    const currentDate = new Date().toISOString().split('T')[0]

    const reportResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: `You are generating a status briefing for Vetree, an evidence-based veterinary research platform. Output clean markdown only. No preamble.`,
      messages: [{
        role: 'user',
        content: `Generate a complete status briefing from this data.

SNAPSHOT: ${JSON.stringify(snapshot, null, 2)}
SIGNALS: ${JSON.stringify(signals?.slice(0, 10), null, 2)}
INSIGHTS: ${JSON.stringify(finalInsights.insights, null, 2)}
TOP ACTIONS: ${JSON.stringify(finalInsights.top_3_actions, null, 2)}

Output this exact markdown structure:

# Vetree Status Briefing — ${currentDate}

## 📊 Platform Metrics (Last 7 Days)
- DAU / WAU / MAU: X / X / X
- DAU/MAU Stickiness: X%
- Total Searches: X (X% zero results)
- Articles Saved: X
- Synthesis Runs: X (X% helpful)
- Avg Session Duration: Xm Xs
- Top Traffic Sources: [list]
- Top Countries: [list if available]

## 🔍 Search Intelligence
- Top searched queries: [list top 5 with counts]
- Zero-result queries: [list top 5 — these are content gaps]

## 🧠 AI Analysis — [X] Insights This Week
[For each insight:]
### [area]: [observation]
- Why it matters: [why_it_matters]
- Recommended action: [recommendation]
- Time to implement: [time] | Impact: [impact] | Confidence: [confidence]

## 🎯 Top 3 Priority Actions
1. [action 1]
2. [action 2]
3. [action 3]

## 📚 Content Roadmap (Unmet Search Demand)
[list topics]

## ⚠️ Churn Risks
[list or "None detected"]

## 🌱 Growth OS Status
- Campaign: Day X/90
- Platform rotation: [today's platform]

---
*Generated by Vetree Analysis Agent on ${currentDate}*
*Paste this into Claude.ai for strategic discussion*`
      }]
    })

    const reportText = reportResponse.content[0].type === 'text'
      ? reportResponse.content[0].text
      : ''

    console.log('[insights] Report generated, length:', reportText.length, 'chars')

    // Save to DB
    console.log('[insights] Saving to database...')
    const runId = `analysis_${Date.now()}`
    const { error: insertError } = await supabase.from('analytics_insights').insert({
      run_id: runId,
      insights_json: finalInsights.insights || [],
      top_3_actions: finalInsights.top_3_actions || [],
      content_roadmap: finalInsights.content_roadmap || [],
      churn_risks: finalInsights.churn_risks || [],
      report_markdown: reportText,
      model_used: 'claude-sonnet-4-20250514',
      tokens_used: response.usage.input_tokens + response.usage.output_tokens + (reportResponse.usage.input_tokens + reportResponse.usage.output_tokens)
    })

    if (insertError) {
      console.error('[insights] Database insert error:', insertError)
      throw new Error(`Database insert failed: ${insertError.message}`)
    }
    console.log('[insights] Saved to database successfully, run_id:', runId)

    // Send to Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      console.log('[insights] Sending Slack notification...')

      // Safety check before building message
      if (!finalInsights || typeof finalInsights !== 'object') {
        console.error('[insights] finalInsights is invalid, skipping Slack')
      } else {
        const slackMessage = {
          text: `🧠 *Vetree Weekly Analysis*\n\n${finalInsights.weekly_summary || 'Weekly analysis complete.'}\n\n*TOP 3 ACTIONS:*\n${
            (finalInsights.top_3_actions || []).map((a: string, i: number) => `${i+1}. ${a}`).join('\n') || 'None'
          }\n\n*CONTENT ROADMAP:*\n${
            (finalInsights.content_roadmap || []).map((t: string) => `• ${t}`).join('\n') || 'None'
          }\n\n*CHURN RISKS:*\n${
            (finalInsights.churn_risks || []).length > 0
              ? (finalInsights.churn_risks || []).map((r: string) => `⚠️ ${r}`).join('\n')
              : 'None detected'
          }\n\n<https://vetree.app/admin/analytics|View Full Report →>`
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
