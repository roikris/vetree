export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { normalizeQuery } from '@/lib/utils/normalizeQuery'
import * as Sentry from '@sentry/nextjs'
import { Redis } from '@upstash/redis'
import { synthesisLimiter, getClientIP } from '@/lib/ratelimit'
import { detectBotName } from '@/lib/bot-detection'
import { analyticsRecordingEnabled, isQATraffic } from '@/lib/analytics/recording'
import { CLAUDE_MODEL, NO_UPFRONT_THINKING, responseText } from '@/lib/ai/model'

// Cost controls (Codex re-evaluation #5c). Synthesis auto-runs on every search (experiment
// restarted 2026-09-28), and each cache miss is a Claude call on a public route:
//   - query length 3–200;
//   - per-visitor limit on NEW generations (synthesisLimiter; cache hits are free);
//   - one generation per topic at a time (Redis lock, owner token) — concurrent requests get 409
//     and the panel retries;
//   - a daily ceiling on paid Claude calls (SYNTHESIS_DAILY_CAP, default 100 ≈ a few dollars/day),
//     reserved atomically in Redis before each call.
const DAILY_CAP = Number(process.env.SYNTHESIS_DAILY_CAP) > 0 ? Number(process.env.SYNTHESIS_DAILY_CAP) : 100
const LOCK_SECONDS = 90

/**
 * Atomically reserves one paid generation against today's (UTC) budget. Counts attempted Claude
 * calls, not cached results, so failed or uncached generations still consume budget. Without
 * Redis (non-production) it falls back to counting today's cached syntheses.
 */
async function reserveGeneration(redis: Redis | null, supabase: any): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10)
  if (redis) {
    const key = `synthesis:budget:${day}`
    const n = await redis.incr(key)
    if (n === 1) await redis.expire(key, 2 * 24 * 3600)
    return n <= DAILY_CAP
  }
  const { count, error } = await supabase
    .from('topic_syntheses')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${day}T00:00:00Z`)
  if (error) throw new Error(`daily-cap count failed: ${error.message}`)
  return (count ?? 0) < DAILY_CAP
}

// Day (UTC) the daily-cap warning was last sent to Sentry from this instance
let capReportedOn: string | null = null

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  // Assigned once the request is identified; used by the catch to record a failed attempt
  let recordFailure: (() => Promise<boolean>) | null = null

  try {
    // A body that isn't JSON is the caller's error (400), never a captured exception: JSON.parse
    // errors quote the raw input, which would carry whatever was sent into Sentry
    let body: { query?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { query } = body

    if (typeof query !== 'string' || query.trim().length < 3 || query.trim().length > 200) {
      return NextResponse.json(
        { error: 'Query must be 3–200 characters' },
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

    // Experiment events go to analytics_events (CLAUDE.md rule 12) — never page_views, where they
    // inflated page views, top pages, countries and devices (moved out by migration 065).
    // Recorded only by the production deployment (previews and local dev share the production DB),
    // never for QA smoke traffic; crawlers are recorded with bot_name set and filtered by readers.
    // Awaited before responding (a serverless function may be frozen once the response is sent),
    // and a failure reaches Sentry — a lost run is a lost experiment data point.
    //   synthesis_attempt       — a reader asked for a synthesis (busy-topic retries excluded)
    //   synthesis_run           — a synthesis was served (cache hit or new generation)
    //   synthesis_blocked       — a new generation was refused by a cost control (429 / daily cap)
    //   synthesis_insufficient  — fewer than 3 relevant studies; nothing to synthesize
    //   synthesis_failed        — the generation errored (Claude, database, Redis)
    // (The panel records synthesis_engaged, synthesis_busy_timeout and synthesis_client_error via
    //  /api/analytics/event.)
    // Returns the stored event's created_at (null when not recorded); the client counts engagement
    // only for a recorded run, and only when that timestamp is inside the experiment window.
    const userAgent = request.headers.get('user-agent') || ''
    const recording = analyticsRecordingEnabled() && !isQATraffic(userAgent, request.headers)
    const botName = detectBotName(userAgent)
    const recordEvent = async (
      event: 'synthesis_attempt' | 'synthesis_run' | 'synthesis_blocked' | 'synthesis_insufficient' | 'synthesis_failed'
    ): Promise<string | null> => {
      if (!recording) return null
      const { data, error } = await supabase.from('analytics_events')
        .insert({ event_name: event, user_id: userId, bot_name: botName })
        .select('created_at')
        .single()
      if (error) {
        console.error(`[synthesis] ${event} tracking failed:`, error.message)
        Sentry.captureMessage(`[synthesis] ${event} tracking failed: ${error.code} ${error.message}`, 'error')
        return null
      }
      return data?.created_at ?? null
    }
    const trackOutcome = async (event: Parameters<typeof recordEvent>[0]) => (await recordEvent(event)) !== null
    recordFailure = () => trackOutcome('synthesis_failed')
    // One attempt per reader request; the panel's busy-topic retries are marked and not counted
    if (request.headers.get('x-synthesis-retry') !== '1') await trackOutcome('synthesis_attempt')

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
      // Same threshold as generation (>= 3 studies), so every generated synthesis is reusable
      if (!articlesInCache || articlesInCache.length < 3) {
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

        // Track synthesis serve for analytics (cache hit)
        const runAt = await recordEvent('synthesis_run')

        return NextResponse.json({
          run_recorded: runAt !== null,
          run_at: runAt,
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

    // STEP 2: Cache miss. One generation per topic at a time: a concurrent reader of the same
    // topic gets 409 and the panel retries until the first generation lands in the cache.
    // Without Upstash (non-production), no lock and no Redis budget.
    const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null
    if (!redis && process.env.VERCEL_ENV === 'production') {
      // Fail closed: without Redis there is no lock and only an approximate budget (rule 13)
      Sentry.captureMessage('[synthesis] Upstash missing in production — generation refused', 'error')
      await trackOutcome('synthesis_failed')
      return NextResponse.json({ error: 'Topic synthesis is temporarily unavailable.' }, { status: 503 })
    }
    const lockKey = `synthesis:generating:${queryNormalized}`
    const lockToken = crypto.randomUUID()
    if (redis) {
      const acquired = await redis.set(lockKey, lockToken, { nx: true, ex: LOCK_SECONDS })
      if (!acquired) {
        return NextResponse.json(
          { error: 'This synthesis is already being prepared — try again in a few seconds.', generating: true },
          { status: 409 }
        )
      }
    }
    // Release only our own lock: a generation that outlived LOCK_SECONDS must not delete a
    // successor's lock.
    const releaseLock = async () => {
      if (!redis) return
      await redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        [lockKey], [lockToken]
      ).catch(() => {})
    }

    try {
    console.log('[synthesis] Cache miss, generating new synthesis')  // never log the reader's query

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
      // A database failure is a failed attempt, not "too few studies" (which the panel caches)
      throw new Error(`search_articles_synthesis failed: ${rpcError.code} ${rpcError.message}`)
    }

    // Large animal filter in JS (per CLAUDE.md)
    const articlesForSynthesis = (rpcArticles || []).filter((a: any) =>
      !a.labels?.some((l: string) => LARGE_ANIMAL_LABELS.includes(l))
    )

    console.log('[synthesis] articlesForSynthesis:', articlesForSynthesis.length)

    if (articlesForSynthesis.length < 3) {
      await trackOutcome('synthesis_insufficient')
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
    const modelToUse = CLAUDE_MODEL

    // Cost controls, applied only now — immediately before the paid Claude call — so a lock
    // conflict or an insufficient-evidence answer never spends a reader's allowance or budget.
    const { success: withinLimit } = await synthesisLimiter.limit(`synthesis:${userId ?? getClientIP(request)}`)
    if (!withinLimit) {
      await trackOutcome('synthesis_blocked')
      return NextResponse.json({ error: 'Too many syntheses — please wait a few minutes and try again.', retryable: false }, { status: 429 })
    }
    if (!(await reserveGeneration(redis, supabase))) {
      await trackOutcome('synthesis_blocked')
      // Expected once the cap is hit: report it once per day per server instance, not per request
      const today = new Date().toISOString().slice(0, 10)
      if (capReportedOn !== today) {
        capReportedOn = today
        Sentry.captureMessage(`[synthesis] daily cap of ${DAILY_CAP} reached`, 'warning')
      }
      return NextResponse.json({ error: 'Topic synthesis has reached its daily limit — please try again tomorrow.', retryable: false }, { status: 503 })
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    })

    const response = await anthropic.messages.create({
      ...NO_UPFRONT_THINKING,
      model: modelToUse,
      max_tokens: 4000,
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

    const synthesisText = responseText(response)

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
      // This failed silently from 2026-05-18 to 2026-09-28 (missing search_version column,
      // migration 063): every synthesis was regenerated. Never again unnoticed.
      console.error('[synthesis] Failed to cache synthesis:', insertError)
      Sentry.captureMessage(`[synthesis] cache insert failed: ${insertError.code} ${insertError.message}`, 'error')
    }

    // Track synthesis serve for analytics (cache miss / new generation)
    const runAt = await recordEvent('synthesis_run')

    return NextResponse.json({
      run_recorded: runAt !== null,
      run_at: runAt,
      synthesis_html: synthesisHtml,
      article_ids: articlesForSynthesis.map((a: any) => a.id),
      articles: packets, // BUG 2 FIX: Include article data for frontend display
      study_type_breakdown: studyTypeBreakdown,
      from_cache: false,
      model_used: modelToUse,
      generation_time_ms: generationTime,
      cache_hits: 0
    })

    } finally {
      await releaseLock()
    }
  } catch (error) {
    console.error('[synthesis] Error:', error)
    Sentry.captureException(error)
    await recordFailure?.().catch(() => false)
    return NextResponse.json(
      {
        error: 'Failed to generate synthesis',
        details: String(error)
      },
      { status: 500 }
    )
  }
}
