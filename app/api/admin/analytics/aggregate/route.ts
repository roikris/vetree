export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const adminId = '90cb8294-b593-4144-a9f5-23ca52dd5e35'
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // DAU - unique non-admin users today
    const { count: dau } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today)
      .or(`user_id.is.null,user_id.neq.${adminId}`)

    // WAU
    const { count: wau } = await supabase
      .from('page_views')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo)
      .or(`user_id.is.null,user_id.neq.${adminId}`)

    // MAU
    const { count: mau } = await supabase
      .from('page_views')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo)
      .or(`user_id.is.null,user_id.neq.${adminId}`)

    // Total searches + zero result searches (exclude admin)
    const { data: searchData } = await supabase
      .from('search_logs')
      .select('query, results_count, user_id')
      .gte('created_at', sevenDaysAgo)
      .or(`user_id.is.null,user_id.neq.${adminId}`)

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

    // Synthesis runs + feedback (exclude admin)
    const { count: synthesisRuns } = await supabase
      .from('topic_syntheses')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo)
      .or(`user_id.is.null,user_id.neq.${adminId}`)

    const { count: synthesisHelpful } = await supabase
      .from('synthesis_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('feedback', 'helpful')
      .gte('created_at', sevenDaysAgo)
      .or(`user_id.is.null,user_id.neq.${adminId}`)

    const { count: synthesisNotRelevant } = await supabase
      .from('synthesis_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('feedback', 'not_relevant')
      .gte('created_at', sevenDaysAgo)
      .or(`user_id.is.null,user_id.neq.${adminId}`)

    // Articles saved (exclude admin)
    const { count: articlesSaved } = await supabase
      .from('saved_articles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo)
      .neq('user_id', adminId)

    // Top saved articles (by saves, NOT views - avoid promotion bias)
    const { data: savedArticlesData } = await supabase
      .from('saved_articles')
      .select('article_id')
      .gte('created_at', thirtyDaysAgo)
      .neq('user_id', adminId)

    const saveCounts = savedArticlesData?.reduce((acc, s) => {
      acc[s.article_id] = (acc[s.article_id] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topSavedIds = Object.entries(saveCounts || {})
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id)

    // Avg session duration
    const { data: sessionData } = await supabase
      .from('page_views')
      .select('duration_seconds')
      .gte('created_at', sevenDaysAgo)
      .not('duration_seconds', 'is', null)
      .or(`user_id.is.null,user_id.neq.${adminId}`)

    const avgDuration = sessionData?.length
      ? Math.round(sessionData.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / sessionData.length)
      : 0

    // Traffic sources
    const { data: trafficData } = await supabase
      .from('page_views')
      .select('utm_source')
      .gte('created_at', sevenDaysAgo)
      .not('utm_source', 'is', null)

    const trafficSources = trafficData?.reduce((acc, t) => {
      if (t.utm_source) acc[t.utm_source] = (acc[t.utm_source] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Upsert snapshot
    const { error } = await supabase.from('analytics_daily_snapshot').upsert({
      date: today,
      dau: dau || 0,
      wau: wau || 0,
      mau: mau || 0,
      total_searches: totalSearches,
      zero_result_searches: zeroResults.length,
      zero_result_rate: zeroResultRate,
      synthesis_runs: synthesisRuns || 0,
      synthesis_helpful: synthesisHelpful || 0,
      synthesis_not_relevant: synthesisNotRelevant || 0,
      articles_saved: articlesSaved || 0,
      avg_session_duration_seconds: avgDuration,
      top_searches: topSearches,
      top_saved_articles: topSavedIds,
      device_breakdown: {},
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
