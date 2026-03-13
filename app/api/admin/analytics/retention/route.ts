export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check admin authorization
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleData?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Use service role for analytics queries
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Get total registered users
    const { data: allUsers } = await adminSupabase.auth.admin.listUsers()
    const totalUsers = allUsers?.users?.length || 0

    // DAU - unique users today
    const { data: dauData } = await adminSupabase
      .from('page_views')
      .select('user_id')
      .gte('created_at', `${today}T00:00:00Z`)
      .not('user_id', 'is', null)

    const dau_today = dauData ? new Set(dauData.map(pv => pv.user_id)).size : 0

    // WAU - unique users last 7 days
    const { data: wauData } = await adminSupabase
      .from('page_views')
      .select('user_id')
      .gte('created_at', `${sevenDaysAgo}T00:00:00Z`)
      .not('user_id', 'is', null)

    const wau = wauData ? new Set(wauData.map(pv => pv.user_id)).size : 0

    // MAU - unique users last 30 days
    const { data: mauData } = await adminSupabase
      .from('page_views')
      .select('user_id')
      .gte('created_at', `${thirtyDaysAgo}T00:00:00Z`)
      .not('user_id', 'is', null)

    const mau = mauData ? new Set(mauData.map(pv => pv.user_id)).size : 0

    // Get users active in last 7 days
    const activeUsers7d = wauData ? new Set(wauData.map(pv => pv.user_id)).size : 0
    const retention_7d = totalUsers > 0 ? (activeUsers7d / totalUsers) * 100 : 0

    // Get users active in last 30 days
    const activeUsers30d = mauData ? new Set(mauData.map(pv => pv.user_id)).size : 0
    const retention_30d = totalUsers > 0 ? (activeUsers30d / totalUsers) * 100 : 0

    // Churned users - not seen in 14+ days
    const { data: recentUsers } = await adminSupabase
      .from('page_views')
      .select('user_id')
      .gte('created_at', `${fourteenDaysAgo}T00:00:00Z`)
      .not('user_id', 'is', null)

    const recentUserIds = new Set(recentUsers?.map(pv => pv.user_id) || [])
    const churned_users = totalUsers - recentUserIds.size

    // Calculate average days between visits
    const { data: userVisits } = await adminSupabase
      .from('page_views')
      .select('user_id, created_at')
      .gte('created_at', `${thirtyDaysAgo}T00:00:00Z`)
      .not('user_id', 'is', null)
      .order('created_at', { ascending: true })

    let totalGapDays = 0
    let gapCount = 0

    if (userVisits && userVisits.length > 0) {
      // Group by user
      const userVisitMap = new Map<string, Date[]>()
      userVisits.forEach(visit => {
        const userId = visit.user_id
        const date = new Date(visit.created_at)
        if (!userVisitMap.has(userId)) {
          userVisitMap.set(userId, [])
        }
        userVisitMap.get(userId)!.push(date)
      })

      // Calculate gaps for each user
      userVisitMap.forEach((dates) => {
        // Get unique days
        const uniqueDays = Array.from(new Set(dates.map(d => d.toISOString().split('T')[0])))
          .sort()
          .map(dateStr => new Date(dateStr))

        for (let i = 1; i < uniqueDays.length; i++) {
          const gap = (uniqueDays[i].getTime() - uniqueDays[i - 1].getTime()) / (1000 * 60 * 60 * 24)
          totalGapDays += gap
          gapCount++
        }
      })
    }

    const avg_days_between_visits = gapCount > 0 ? totalGapDays / gapCount : 0

    // Top returning users - calculate manually
    let top_returning_users: any[] = []

    {
      // Manual calculation
      const { data: allPageViews } = await adminSupabase
        .from('page_views')
        .select('user_id, created_at')
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false })

      if (allPageViews) {
        const userStats = new Map<string, { activeDays: Set<string>, lastSeen: Date }>()

        allPageViews.forEach(pv => {
          if (!userStats.has(pv.user_id)) {
            userStats.set(pv.user_id, { activeDays: new Set(), lastSeen: new Date(pv.created_at) })
          }
          const stats = userStats.get(pv.user_id)!
          const date = new Date(pv.created_at)
          stats.activeDays.add(date.toISOString().split('T')[0])
          if (date > stats.lastSeen) {
            stats.lastSeen = date
          }
        })

        // Get user emails
        const userIds = Array.from(userStats.keys())
        const userEmails = new Map<string, string>()

        for (const userId of userIds) {
          const { data: userData } = await adminSupabase.auth.admin.getUserById(userId)
          if (userData?.user?.email) {
            userEmails.set(userId, userData.user.email)
          }
        }

        // Build top users array
        top_returning_users = Array.from(userStats.entries())
          .map(([userId, stats]) => ({
            email: userEmails.get(userId) || 'unknown',
            active_days: stats.activeDays.size,
            last_seen: stats.lastSeen.toISOString().split('T')[0],
            days_since_last_visit: Math.floor((now.getTime() - stats.lastSeen.getTime()) / (1000 * 60 * 60 * 24))
          }))
          .sort((a, b) => b.active_days - a.active_days)
          .slice(0, 10)
      }
    }

    // Get DAU over last 30 days for chart
    const { data: dailyData } = await adminSupabase
      .from('page_views')
      .select('user_id, created_at')
      .gte('created_at', `${thirtyDaysAgo}T00:00:00Z`)
      .not('user_id', 'is', null)

    const dailyActiveUsers: { date: string; users: number }[] = []

    if (dailyData) {
      const dailyMap = new Map<string, Set<string>>()

      dailyData.forEach(pv => {
        const date = new Date(pv.created_at).toISOString().split('T')[0]
        if (!dailyMap.has(date)) {
          dailyMap.set(date, new Set())
        }
        dailyMap.get(date)!.add(pv.user_id)
      })

      // Fill in all dates (including zeros)
      for (let i = 30; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        dailyActiveUsers.push({
          date,
          users: dailyMap.get(date)?.size || 0
        })
      }
    }

    return NextResponse.json({
      dau_today,
      wau,
      mau,
      retention_7d: Math.round(retention_7d * 10) / 10,
      retention_30d: Math.round(retention_30d * 10) / 10,
      churned_users,
      avg_days_between_visits: Math.round(avg_days_between_visits * 10) / 10,
      top_returning_users,
      daily_active_users: dailyActiveUsers,
      total_users: totalUsers,
      stickiness: mau > 0 ? Math.round((dau_today / mau) * 1000) / 10 : 0
    })

  } catch (error) {
    console.error('[admin/analytics/retention] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch retention analytics' },
      { status: 500 }
    )
  }
}
