import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Admin auth
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: role } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Optional date range filter
  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  // 1. Fetch all linkedin post metrics
  let metricsQuery = supabase
    .from('linkedin_post_metrics')
    .select('id, post_url, post_date, article_id, impressions, engagements')
    .order('post_date', { ascending: false })

  if (from) metricsQuery = metricsQuery.gte('post_date', from)
  if (to) metricsQuery = metricsQuery.lte('post_date', to)

  const { data: metrics, error: metricsError } = await metricsQuery
  if (metricsError) return NextResponse.json({ error: metricsError.message }, { status: 500 })

  if (!metrics?.length) {
    return NextResponse.json({ rows: [], totals: { impressions: 0, engagements: 0, sessions: 0, unique_visitors: 0, saves: 0, ctr: 0 } })
  }

  // 2. Fetch LinkedIn page_view sessions (utm_source=linkedin, path starts with /article/)
  let pvQuery = supabase
    .from('page_views')
    .select('path, ip_hash, user_id, utm_source')
    .eq('utm_source', 'linkedin')
    .like('path', '/article/%')
    .neq('user_id', '90cb8294-b593-4144-a9f5-23ca52dd5e35') // exclude admin

  if (from) pvQuery = pvQuery.gte('created_at', from)
  if (to) pvQuery = pvQuery.lte('created_at', to + 'T23:59:59Z')

  const { data: pageViews } = await pvQuery

  // 3. Fetch saves for matched article_ids
  const articleIds = [...new Set(metrics.map(m => m.article_id).filter(Boolean))] as string[]

  let savesData: { article_id: string }[] = []
  if (articleIds.length) {
    let savesQuery = supabase
      .from('saved_articles')
      .select('article_id')
      .in('article_id', articleIds)
      .neq('user_id', '90cb8294-b593-4144-a9f5-23ca52dd5e35') // exclude admin

    if (from) savesQuery = savesQuery.gte('saved_at', from)
    if (to) savesQuery = savesQuery.lte('saved_at', to + 'T23:59:59Z')

    const { data } = await savesQuery
    savesData = data || []
  }

  // 4. Fetch article titles for matched articles
  let titles: Record<string, string> = {}
  if (articleIds.length) {
    const { data: articles } = await supabase
      .from('articles')
      .select('id, title')
      .in('id', articleIds)
    for (const a of articles || []) titles[a.id] = a.title
  }

  // Build per-article lookups
  const sessionsByArticle: Record<string, number> = {}
  const visitorsByArticle: Record<string, Set<string>> = {}

  for (const pv of pageViews || []) {
    // Extract article_id from path "/article/[id]"
    const match = pv.path?.match(/^\/article\/([^/?]+)/)
    if (!match) continue
    const aid = match[1]
    sessionsByArticle[aid] = (sessionsByArticle[aid] || 0) + 1
    if (!visitorsByArticle[aid]) visitorsByArticle[aid] = new Set()
    visitorsByArticle[aid].add(pv.user_id || pv.ip_hash || 'anon')
  }

  const savesByArticle: Record<string, number> = {}
  for (const s of savesData) {
    if (s.article_id) savesByArticle[s.article_id] = (savesByArticle[s.article_id] || 0) + 1
  }

  // Compose rows
  const rows = metrics.map(m => {
    const sessions = m.article_id ? (sessionsByArticle[m.article_id] || 0) : 0
    const unique_visitors = m.article_id ? (visitorsByArticle[m.article_id]?.size || 0) : 0
    const saves = m.article_id ? (savesByArticle[m.article_id] || 0) : 0
    const ctr = m.impressions > 0 ? parseFloat(((sessions / m.impressions) * 100).toFixed(2)) : 0

    return {
      id: m.id,
      post_url: m.post_url,
      post_date: m.post_date,
      article_id: m.article_id,
      article_title: m.article_id ? (titles[m.article_id] || null) : null,
      impressions: m.impressions,
      engagements: m.engagements,
      sessions,
      unique_visitors,
      saves,
      ctr,
    }
  })

  // Totals
  const totals = rows.reduce((acc, r) => ({
    impressions: acc.impressions + r.impressions,
    engagements: acc.engagements + r.engagements,
    sessions: acc.sessions + r.sessions,
    unique_visitors: acc.unique_visitors + r.unique_visitors,
    saves: acc.saves + r.saves,
    ctr: 0, // computed below
  }), { impressions: 0, engagements: 0, sessions: 0, unique_visitors: 0, saves: 0, ctr: 0 })

  totals.ctr = totals.impressions > 0
    ? parseFloat(((totals.sessions / totals.impressions) * 100).toFixed(2))
    : 0

  // Fetch daily trend data for chart
  let dailyQuery = supabase
    .from('linkedin_daily_metrics')
    .select('metric_date, impressions, new_followers')
    .order('metric_date', { ascending: true })
  if (from) dailyQuery = dailyQuery.gte('metric_date', from)
  if (to) dailyQuery = dailyQuery.lte('metric_date', to)

  const { data: dailyTrend } = await dailyQuery

  return NextResponse.json({ rows, totals, daily_trend: dailyTrend ?? [] })
}
