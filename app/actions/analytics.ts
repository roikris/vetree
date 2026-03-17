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

  // Total pageviews (exclude admin, include anonymous)
  const { count: totalViews } = await supabase
    .from('page_views')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())
    .or('user_id.is.null,user_id.neq.90cb8294-b593-4144-a9f5-23ca52dd5e35')

  // Unique visitors (exclude admin, include anonymous)
  const { data: uniqueVisitors } = await supabase
    .from('page_views')
    .select('ip_hash')
    .gte('created_at', startDate.toISOString())
    .or('user_id.is.null,user_id.neq.90cb8294-b593-4144-a9f5-23ca52dd5e35')

  const uniqueCount = uniqueVisitors ? [...new Set(uniqueVisitors.map(v => v.ip_hash))].length : 0

  // Logged-in vs anonymous (exclude admin)
  const { count: loggedInViews } = await supabase
    .from('page_views')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())
    .not('user_id', 'is', null)
    .neq('user_id', '90cb8294-b593-4144-a9f5-23ca52dd5e35')

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
    .or('user_id.is.null,user_id.neq.90cb8294-b593-4144-a9f5-23ca52dd5e35')

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
    .or('user_id.is.null,user_id.neq.90cb8294-b593-4144-a9f5-23ca52dd5e35')
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

  // Get article page views (exclude admin, include anonymous)
  const { data: pageViews } = await supabase
    .from('page_views')
    .select('path, ip_hash')
    .gte('created_at', startDate.toISOString())
    .like('path', '/article/%')
    .or('user_id.is.null,user_id.neq.90cb8294-b593-4144-a9f5-23ca52dd5e35')

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

export async function getSessionDuration(days: number = 7) {
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

  // Get all sessions with duration (exclude admin, include anonymous)
  const { data: sessions } = await supabase
    .from('page_views')
    .select('duration_seconds')
    .gte('created_at', startDate.toISOString())
    .not('duration_seconds', 'is', null)
    .or('user_id.is.null,user_id.neq.90cb8294-b593-4144-a9f5-23ca52dd5e35')

  if (!sessions || sessions.length === 0) {
    return {
      data: {
        average: 0,
        median: 0,
        distribution: {
          under1min: 0,
          between1and3: 0,
          between3and10: 0,
          over10min: 0
        }
      },
      error: null
    }
  }

  // Filter valid sessions: 0 < duration <= 1800 seconds (30 min cap)
  // Sessions longer than 30 min = user left tab open, not real engagement
  const validSessions = sessions.filter(s =>
    s.duration_seconds > 0 &&
    s.duration_seconds <= 1800  // cap at 30 min
  )

  if (validSessions.length === 0) {
    return {
      data: {
        average: 0,
        median: 0,
        distribution: {
          under1min: 0,
          between1and3: 0,
          between3and10: 0,
          over10min: 0
        }
      },
      error: null
    }
  }

  // Calculate average (filtered)
  const total = validSessions.reduce((sum, s) => sum + s.duration_seconds, 0)
  const average = Math.round(total / validSessions.length)

  // Calculate median
  const sortedDurations = validSessions.map(s => s.duration_seconds).sort((a, b) => a - b)
  const median = sortedDurations[Math.floor(sortedDurations.length / 2)]

  // Calculate distribution (use ALL sessions for distribution, not just filtered)
  const distribution = {
    under1min: 0,
    between1and3: 0,
    between3and10: 0,
    over10min: 0
  }

  sessions.forEach(s => {
    const minutes = (s.duration_seconds || 0) / 60
    if (minutes < 1) distribution.under1min++
    else if (minutes < 3) distribution.between1and3++
    else if (minutes < 10) distribution.between3and10++
    else distribution.over10min++
  })

  return { data: { average, median, distribution }, error: null }
}

export async function getRecentSearches(days: number = 7, limit: number = 20) {
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

  const { data: searches } = await supabase
    .from('search_logs')
    .select('query, results_count, created_at')
    .gte('created_at', startDate.toISOString())

  if (!searches || searches.length === 0) {
    return { data: [], error: null }
  }

  // Group by query and aggregate
  const searchStats: Record<string, {
    count: number
    avgResults: number
    lastSearched: string
  }> = {}

  searches.forEach(search => {
    const query = search.query.toLowerCase()
    if (!searchStats[query]) {
      searchStats[query] = {
        count: 0,
        avgResults: 0,
        lastSearched: search.created_at
      }
    }
    searchStats[query].count++
    searchStats[query].avgResults += search.results_count || 0
    if (search.created_at > searchStats[query].lastSearched) {
      searchStats[query].lastSearched = search.created_at
    }
  })

  // Calculate averages and format
  const recentSearches = Object.entries(searchStats)
    .map(([query, stats]) => ({
      query,
      count: stats.count,
      avgResults: Math.round(stats.avgResults / stats.count),
      lastSearched: stats.lastSearched
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

  return { data: recentSearches, error: null }
}

export async function getDeviceBreakdown(days: number = 7) {
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
    .select('device_type')
    .gte('created_at', startDate.toISOString())
    .or('user_id.is.null,user_id.neq.90cb8294-b593-4144-a9f5-23ca52dd5e35')

  if (!pageViews) return { data: { mobile: 0, desktop: 0, unknown: 0 }, error: null }

  // Count by device type
  const breakdown = {
    mobile: 0,
    desktop: 0,
    unknown: 0
  }

  pageViews.forEach(view => {
    const device = view.device_type?.toLowerCase() || 'unknown'
    if (device === 'mobile') {
      breakdown.mobile++
    } else if (device === 'desktop') {
      breakdown.desktop++
    } else {
      breakdown.unknown++
    }
  })

  return { data: breakdown, error: null }
}

export async function getTopCountries(days: number = 7, limit: number = 10) {
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
    .select('country, ip_hash')
    .gte('created_at', startDate.toISOString())
    .or('user_id.is.null,user_id.neq.90cb8294-b593-4144-a9f5-23ca52dd5e35')

  if (!pageViews) return { data: [], error: null }

  // Group by country
  const countryStats: Record<string, { views: number, uniqueVisitors: Set<string> }> = {}

  pageViews.forEach(view => {
    const country = view.country || 'Unknown'
    if (!countryStats[country]) {
      countryStats[country] = { views: 0, uniqueVisitors: new Set() }
    }
    countryStats[country].views++
    countryStats[country].uniqueVisitors.add(view.ip_hash)
  })

  // Convert to array and sort by views
  const topCountries = Object.entries(countryStats)
    .map(([country, stats]) => ({
      country,
      views: stats.views,
      uniqueVisitors: stats.uniqueVisitors.size
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit)

  return { data: topCountries, error: null }
}

export async function getSavedArticlesStats(days: number = 7) {
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

  // Total saved articles count
  const { count: totalSaved } = await supabase
    .from('saved_articles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())

  // Unique users who saved at least one article
  const { data: savedArticles } = await supabase
    .from('saved_articles')
    .select('user_id')
    .gte('created_at', startDate.toISOString())

  const uniqueUsers = savedArticles ? [...new Set(savedArticles.map(s => s.user_id))].length : 0

  return {
    data: {
      totalSaved: totalSaved || 0,
      uniqueUsers
    },
    error: null
  }
}

export async function getTrafficSources(days: number = 7) {
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

  // Get all page views with UTM data and referrers (exclude admin)
  const { data: pageViews } = await supabase
    .from('page_views')
    .select('utm_source, referrer, ip_hash, user_id')
    .gte('created_at', startDate.toISOString())
    .or('user_id.is.null,user_id.neq.90cb8294-b593-4144-a9f5-23ca52dd5e35')

  if (!pageViews) return { data: [], error: null }

  // Categorize traffic sources
  const sourceStats: Record<string, { visits: number, uniqueVisitors: Set<string>, signups: Set<string> }> = {}

  const categorizeSource = (utmSource: string | null, referrer: string | null): string => {
    // UTM source takes priority
    if (utmSource) {
      const source = utmSource.toLowerCase()
      if (source === 'facebook') return 'Facebook'
      if (source === 'whatsapp') return 'WhatsApp'
      if (source === 'linkedin') return 'LinkedIn'
      if (source === 'twitter' || source === 'x') return 'Twitter/X'
      if (source === 'telegram') return 'Telegram'
      if (source === 'instagram') return 'Instagram'
      if (source === 'reddit') return 'Reddit'
      return utmSource // Return custom UTM source
    }

    // Fallback to referrer
    if (referrer) {
      const ref = referrer.toLowerCase()
      if (ref.includes('google')) return 'Google Search'
      if (ref.includes('facebook')) return 'Facebook (organic)'
      if (ref.includes('linkedin')) return 'LinkedIn (organic)'
      if (ref.includes('twitter') || ref.includes('t.co')) return 'Twitter/X (organic)'
      if (ref.includes('instagram')) return 'Instagram (organic)'
      if (ref.includes('reddit')) return 'Reddit (organic)'
      return 'Other Referral'
    }

    return 'Direct / Unknown'
  }

  pageViews.forEach(view => {
    const source = categorizeSource(view.utm_source, view.referrer)

    if (!sourceStats[source]) {
      sourceStats[source] = { visits: 0, uniqueVisitors: new Set(), signups: new Set() }
    }

    sourceStats[source].visits++
    sourceStats[source].uniqueVisitors.add(view.ip_hash)

    // Track signups (visitors who have user_id)
    if (view.user_id) {
      sourceStats[source].signups.add(view.user_id)
    }
  })

  // Convert to array and sort by visits
  const trafficSources = Object.entries(sourceStats)
    .map(([source, stats]) => ({
      source,
      visits: stats.visits,
      uniqueVisitors: stats.uniqueVisitors.size,
      signups: stats.signups.size
    }))
    .sort((a, b) => b.visits - a.visits)

  return { data: trafficSources, error: null }
}
