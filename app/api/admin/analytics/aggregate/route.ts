export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { excludedUsersOrFilter } from '@/lib/analytics-excluded-ids'

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (token !== process.env.DIGEST_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    // DAU uses yesterday to capture a full day (aggregate runs at ~02:00 UTC)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Abort helper — any Supabase error returns 500 immediately rather than silently using null data.
    const fail = (label: string, err: { message: string } | null) => {
      if (!err) return
      const msg = `[analytics/aggregate] ${label} query failed: ${err.message}`
      console.error(msg)
      throw Object.assign(new Error(msg), { status: 500 })
    }

    // DAU - unique ip_hash for yesterday (full day)
    const { data: dauData, error: dauError } = await supabase
      .from('page_views')
      .select('ip_hash')
      .gte('created_at', yesterday)
      .lt('created_at', today)
      .or(excludedUsersOrFilter())
    fail('DAU', dauError)
    const dau = new Set(dauData?.map(r => r.ip_hash) ?? []).size

    // WAU - unique ip_hash last 7 days
    const { data: wauData, error: wauError } = await supabase
      .from('page_views')
      .select('ip_hash')
      .gte('created_at', sevenDaysAgo)
      .or(excludedUsersOrFilter())
    fail('WAU', wauError)
    const wau = new Set(wauData?.map(r => r.ip_hash) ?? []).size

    // MAU - unique ip_hash last 30 days
    const { data: mauData, error: mauError } = await supabase
      .from('page_views')
      .select('ip_hash')
      .gte('created_at', thirtyDaysAgo)
      .or(excludedUsersOrFilter())
    const mau = new Set(mauData?.map(r => r.ip_hash) ?? []).size

    // Sanity guard: a live production site cannot have zero 30-day pageviews.
    // Zero means the reads are broken (wrong key, RLS, network), not quiet traffic.
    // Abort rather than write a zero-filled snapshot that poisons the insights agent.
    if (mauError) {
      console.error('[analytics/aggregate] MAU query error:', mauError)
      return NextResponse.json({ error: `MAU query failed: ${mauError.message}` }, { status: 500 })
    }
    if (mau === 0) {
      console.error('[analytics/aggregate] MAU is 0 — aborting to avoid writing a corrupt snapshot')
      return NextResponse.json({
        error: 'Sanity check failed: 30-day MAU is 0. Reads are broken (check service role key / RLS). Snapshot not written.'
      }, { status: 500 })
    }

    // Registered MAU — distinct authenticated users (non-admin, non-null user_id) in last 30 days
    // This is the real user count; mau above counts all visitors including anonymous/bots
    const { data: registeredMauData, error: regMauError } = await supabase
      .from('page_views')
      .select('user_id')
      .not('user_id', 'is', null)
      .or(excludedUsersOrFilter())
      .gte('created_at', thirtyDaysAgo)
    fail('registered_mau', regMauError)
    const registeredMau = new Set(registeredMauData?.map(r => r.user_id) ?? []).size

    // Total searches + zero result searches (exclude admin)
    const { data: searchData, error: searchError } = await supabase
      .from('search_logs')
      .select('query, results_count, user_id')
      .gte('created_at', sevenDaysAgo)
      .or(excludedUsersOrFilter())
    fail('search_logs', searchError)

    const totalSearches = searchData?.length || 0
    const zeroResults = searchData?.filter(s => s.results_count === 0) || []
    const zeroResultRate = totalSearches > 0 ? zeroResults.length / totalSearches : 0

    // Top searches (most frequent queries last 7 days)
    const searchCounts = searchData?.reduce((acc, s) => {
      acc[s.query] = (acc[s.query] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topSearches = Object.entries(searchCounts || {})
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }))

    // Synthesis engaged (auto-exposure tracked via IntersectionObserver, exclude admin)
    const { count: synthesisEngaged, error: synthEngErr } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .eq('path', '/synthesis/engaged')
      .gte('created_at', sevenDaysAgo)
      .or(excludedUsersOrFilter())
    fail('synthesis_engaged', synthEngErr)

    // Synthesis runs — count all synthesis serves (cache hits + misses) from page_views tracking
    const { count: synthesisRuns, error: synthRunErr } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .eq('path', '/synthesis/run')
      .gte('created_at', sevenDaysAgo)
      .or(excludedUsersOrFilter())
    fail('synthesis_runs', synthRunErr)

    const { count: synthesisHelpful, error: synthHelpErr } = await supabase
      .from('synthesis_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('feedback', 'helpful')
      .gte('created_at', sevenDaysAgo)
      .or(excludedUsersOrFilter())
    fail('synthesis_helpful', synthHelpErr)

    const { count: synthesisNotRelevant, error: synthNotRelErr } = await supabase
      .from('synthesis_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('feedback', 'not_relevant')
      .gte('created_at', sevenDaysAgo)
      .or(excludedUsersOrFilter())
    fail('synthesis_not_relevant', synthNotRelErr)

    // Articles saved (exclude admin) — column is 'saved_at', not 'created_at'
    const { count: articlesSaved, error: savedCountErr } = await supabase
      .from('saved_articles')
      .select('*', { count: 'exact', head: true })
      .gte('saved_at', sevenDaysAgo)
      .or(excludedUsersOrFilter())
    fail('articles_saved', savedCountErr)

    // Top saved articles (by saves, NOT views - avoid promotion bias)
    const { data: savedArticlesData, error: savedDataErr } = await supabase
      .from('saved_articles')
      .select('article_id')
      .gte('saved_at', thirtyDaysAgo)
      .or(excludedUsersOrFilter())
    fail('top_saved_articles', savedDataErr)

    const saveCounts = savedArticlesData?.reduce((acc, s) => {
      acc[s.article_id] = (acc[s.article_id] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topSavedIds = Object.entries(saveCounts || {})
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id)

    // Avg session duration - filter outliers (cap at 30 min = 1800 seconds)
    const { data: sessionData, error: sessionError } = await supabase
      .from('page_views')
      .select('duration_seconds')
      .gte('created_at', sevenDaysAgo)
      .not('duration_seconds', 'is', null)
      .or(excludedUsersOrFilter())
    fail('session_duration', sessionError)

    // Filter valid sessions: 0 < duration <= 1800 seconds (30 min cap)
    const validSessions = sessionData?.filter(s =>
      s.duration_seconds > 0 &&
      s.duration_seconds <= 1800  // cap at 30 min - anything longer = tab left open
    ) || []

    const avgDuration = validSessions.length
      ? Math.round(validSessions.reduce((sum, s) => sum + s.duration_seconds, 0) / validSessions.length)
      : 0

    // Calculate median
    const sortedDurations = validSessions.map(s => s.duration_seconds).sort((a, b) => a - b)
    const medianDuration = sortedDurations.length
      ? sortedDurations[Math.floor(sortedDurations.length / 2)]
      : 0

    // Traffic sources (exclude admin)
    const { data: trafficData, error: trafficError } = await supabase
      .from('page_views')
      .select('utm_source')
      .gte('created_at', sevenDaysAgo)
      .not('utm_source', 'is', null)
      .or(excludedUsersOrFilter())
    fail('traffic_sources', trafficError)

    const trafficSources = trafficData?.reduce((acc, t) => {
      if (t.utm_source) {
        const src = t.utm_source.toLowerCase()
        acc[src] = (acc[src] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    // Device breakdown (exclude admin)
    const { data: deviceData, error: deviceError } = await supabase
      .from('page_views')
      .select('device_type')
      .gte('created_at', sevenDaysAgo)
      .or(excludedUsersOrFilter())
    fail('device_breakdown', deviceError)

    const deviceBreakdown = (deviceData ?? []).reduce((acc, r) => {
      const key = r.device_type ?? 'unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Upsert snapshot
    const { error } = await supabase.from('analytics_daily_snapshot').upsert({
      date: today,
      dau: dau,
      wau: wau,
      mau: mau,
      registered_mau: registeredMau,
      total_searches: totalSearches,
      zero_result_searches: zeroResults.length,
      zero_result_rate: zeroResultRate,
      synthesis_runs: synthesisRuns || 0,
      synthesis_engaged: synthesisEngaged || 0,
      synthesis_helpful: synthesisHelpful || 0,
      synthesis_not_relevant: synthesisNotRelevant || 0,
      articles_saved: articlesSaved || 0,
      avg_session_duration_seconds: avgDuration,
      median_session_duration_seconds: medianDuration,
      top_searches: topSearches,
      top_saved_articles: topSavedIds,
      device_breakdown: deviceBreakdown,
      traffic_sources: trafficSources || {}
    }, { onConflict: 'date' })

    if (error) {
      console.error('[analytics/aggregate] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, date: today })

  } catch (error) {
    console.error('[analytics/aggregate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to aggregate analytics' },
      { status: 500 }
    )
  }
}
