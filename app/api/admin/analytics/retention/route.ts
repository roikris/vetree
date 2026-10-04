export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { EXCLUDED_USER_IDS, excludedUsersOrFilter } from '@/lib/analytics-excluded-ids'

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
      .maybeSingle()

    if (roleData?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Use service role for analytics queries
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date()
    const DAY = 24 * 60 * 60 * 1000
    const dayOf = (d: Date | string) => new Date(d).toISOString().split('T')[0]
    const today = dayOf(now)
    const since = (days: number) => `${dayOf(new Date(now.getTime() - days * DAY))}T00:00:00Z`

    // Registered users, admin + TEST_USER_ID excluded (CLAUDE.md rule 10)
    const authUsers: { id: string; email?: string }[] = []
    for (let page = 1; ; page++) {
      const { data: pageData, error } = await adminSupabase.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw new Error(`users: ${error.message}`)
      authUsers.push(...pageData.users.filter(u => !EXCLUDED_USER_IDS.includes(u.id)))
      if (pageData.users.length < 1000) break
    }
    const totalUsers = authUsers.length
    const emailById = new Map(authUsers.map(u => [u.id, u.email ?? 'unknown']))

    // ONE read of signed-in human page views for the last 30 days, every row (PostgREST stops at
    // 1,000 per request) — admin/test users and crawlers excluded. Every figure below comes from it.
    const views: { user_id: string; created_at: string }[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await adminSupabase
        .from('page_views')
        .select('user_id, created_at')
        .gte('created_at', since(30))
        .not('user_id', 'is', null)
        .is('bot_name', null)
        .or(excludedUsersOrFilter())
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + 999)
      if (error) throw new Error(`page_views: ${error.message}`)
      views.push(...(data || []))
      if (!data || data.length < 1000) break
    }

    const activeSince = (iso: string) => new Set(views.filter(v => v.created_at >= iso).map(v => v.user_id))
    const dau_today = activeSince(`${today}T00:00:00Z`).size
    const wau = activeSince(since(7)).size
    const mau = activeSince(since(30)).size
    const retention_7d = totalUsers > 0 ? (wau / totalUsers) * 100 : 0
    const retention_30d = totalUsers > 0 ? (mau / totalUsers) * 100 : 0
    const churned_users = totalUsers - activeSince(since(14)).size

    // Per user: active days and last visit (last 30 days)
    const userStats = new Map<string, { days: Set<string>; lastSeen: string }>()
    for (const v of views) {
      const st = userStats.get(v.user_id) ?? { days: new Set<string>(), lastSeen: v.created_at }
      st.days.add(dayOf(v.created_at))
      if (v.created_at > st.lastSeen) st.lastSeen = v.created_at
      userStats.set(v.user_id, st)
    }

    // Average days between visits (distinct active days, last 30 days)
    let totalGapDays = 0
    let gapCount = 0
    for (const st of userStats.values()) {
      const days = [...st.days].sort()
      for (let i = 1; i < days.length; i++) {
        totalGapDays += (Date.parse(days[i]) - Date.parse(days[i - 1])) / DAY
        gapCount++
      }
    }
    const avg_days_between_visits = gapCount > 0 ? totalGapDays / gapCount : 0

    // Most active returning users (last 30 days)
    const top_returning_users = [...userStats.entries()]
      .map(([userId, st]) => ({
        email: emailById.get(userId) || 'unknown',
        active_days: st.days.size,
        last_seen: dayOf(st.lastSeen),
        days_since_last_visit: Math.floor((now.getTime() - Date.parse(st.lastSeen)) / DAY),
      }))
      .sort((a, b) => b.active_days - a.active_days)
      .slice(0, 10)

    // Daily active users, last 30 days (zeros included)
    const dailyMap = new Map<string, Set<string>>()
    for (const v of views) {
      const d = dayOf(v.created_at)
      if (!dailyMap.has(d)) dailyMap.set(d, new Set())
      dailyMap.get(d)!.add(v.user_id)
    }
    const dailyActiveUsers: { date: string; users: number }[] = []
    for (let i = 30; i >= 0; i--) {
      const date = dayOf(new Date(now.getTime() - i * DAY))
      dailyActiveUsers.push({ date, users: dailyMap.get(date)?.size || 0 })
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
