'use server'

import { createClient } from '@/lib/supabase/server'

export async function getAnalyticsOverview(days: number = 7) {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Total pageviews
  const { count: totalViews } = await supabase
    .from('page_views')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())

  // Unique visitors
  const { data: uniqueVisitors } = await supabase
    .from('page_views')
    .select('ip_hash')
    .gte('created_at', startDate.toISOString())

  const uniqueCount = uniqueVisitors ? [...new Set(uniqueVisitors.map(v => v.ip_hash))].length : 0

  // Logged-in vs anonymous
  const { count: loggedInViews } = await supabase
    .from('page_views')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())
    .not('user_id', 'is', null)

  return {
    data: {
      totalViews: totalViews || 0,
      uniqueVisitors: uniqueCount,
      loggedInViews: loggedInViews || 0,
      anonymousViews: (totalViews || 0) - (loggedInViews || 0)
    },
    error: null
  }
}

export async function getTopPages(days: number = 7, limit: number = 10) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data: pageViews } = await supabase
    .from('page_views')
    .select('path')
    .gte('created_at', startDate.toISOString())

  if (!pageViews) return { data: [], error: null }

  // Group by path and count
  const pathCounts: Record<string, number> = {}
  pageViews.forEach(view => {
    pathCounts[view.path] = (pathCounts[view.path] || 0) + 1
  })

  const topPages = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([path, count]) => ({ path, views: count }))

  return { data: topPages, error: null }
}

export async function getVisitorsOverTime(days: number = 7) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data: pageViews } = await supabase
    .from('page_views')
    .select('created_at, ip_hash')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true })

  if (!pageViews) return { data: [], error: null }

  // Group by date
  const dailyStats: Record<string, { total: number, unique: Set<string> }> = {}

  pageViews.forEach(view => {
    const date = new Date(view.created_at).toISOString().split('T')[0]
    if (!dailyStats[date]) {
      dailyStats[date] = { total: 0, unique: new Set() }
    }
    dailyStats[date].total++
    dailyStats[date].unique.add(view.ip_hash)
  })

  const data = Object.entries(dailyStats)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, stats]) => ({
      date,
      totalViews: stats.total,
      uniqueVisitors: stats.unique.size
    }))

  return { data, error: null }
}

export async function getTopArticles(days: number = 7, limit: number = 10) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get article page views
  const { data: pageViews } = await supabase
    .from('page_views')
    .select('path, ip_hash')
    .gte('created_at', startDate.toISOString())
    .like('path', '/article/%')

  if (!pageViews) return { data: [], error: null }

  // Extract article IDs and count views
  const articleStats: Record<string, { views: number, uniqueVisitors: Set<string> }> = {}

  pageViews.forEach(view => {
    const match = view.path.match(/\/article\/([^\/]+)/)
    if (match) {
      const articleId = match[1]
      if (!articleStats[articleId]) {
        articleStats[articleId] = { views: 0, uniqueVisitors: new Set() }
      }
      articleStats[articleId].views++
      articleStats[articleId].uniqueVisitors.add(view.ip_hash)
    }
  })

  // Get article details
  const articleIds = Object.keys(articleStats).slice(0, limit * 2) // Get more than needed
  const { data: articles } = await supabase
    .from('articles')
    .select('id, title')
    .in('id', articleIds)

  if (!articles) return { data: [], error: null }

  // Combine stats with article info
  const topArticles = articles
    .map(article => ({
      id: article.id,
      title: article.title,
      views: articleStats[article.id].views,
      uniqueVisitors: articleStats[article.id].uniqueVisitors.size
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit)

  return { data: topArticles, error: null }
}
