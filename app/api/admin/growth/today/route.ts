import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { israelDate, israelDayBounds, israelDateMinus, postingStreak, type ApprovedRow } from '@/lib/growth/daily'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/growth/today — what Growth OS's daily panel starts from (growth-002): today's "posted" rows (Israel
// day) and the posting streak, from growth_agent_memory instead of one browser's localStorage. Read-only. The day's
// article = the newest approved row today (lib/growth/daily.ts reconcileDay); its title comes along for the header.
const STREAK_WINDOW_DAYS = 120

export async function GET() {
  try {
    const cookieClient = await createClient()
    const { data: { user } } = await cookieClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: role } = await cookieClient.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = createAdminClient()
    const today = israelDate(new Date())
    const { start, end } = israelDayBounds(today)
    const since = israelDayBounds(israelDateMinus(today, STREAK_WINDOW_DAYS)).start

    const [todayRes, recentRes] = await Promise.all([
      supabase.from('growth_agent_memory')
        .select('id, article_id, platform, created_at, posted_url')
        .eq('outcome', 'approved').not('article_id', 'is', null)
        .gte('created_at', start).lt('created_at', end)
        .order('created_at', { ascending: true }),
      supabase.from('growth_agent_memory')
        .select('created_at')
        .eq('outcome', 'approved').not('article_id', 'is', null)
        .gte('created_at', since).lt('created_at', end),
    ])
    if (todayRes.error) throw new Error(`today's rows: ${todayRes.error.message}`)
    if (recentRes.error) throw new Error(`recent rows: ${recentRes.error.message}`)

    const rows = (todayRes.data ?? []) as ApprovedRow[]
    const days = new Set((recentRes.data ?? []).map(r => israelDate(r.created_at)))

    // the day's article title, for the header (fresh browser after posting)
    let article: { id: string; title: string } | null = null
    if (rows.length) {
      const id = rows.reduce((a, b) => (b.created_at > a.created_at ? b : a)).article_id
      const { data, error } = await supabase.from('articles').select('id, title').eq('id', id).maybeSingle()
      if (error) throw new Error(`article: ${error.message}`)
      article = data ?? { id, title: id }
    }

    return NextResponse.json({
      date: today,
      rows,
      article,
      streak: postingStreak(days, today),
      days_posted: days.size,
      window_days: STREAK_WINDOW_DAYS,
    })
  } catch (error) {
    console.error('[growth/today] Error:', error)
    return NextResponse.json({ error: 'Failed to load today', details: String(error) }, { status: 500 })
  }
}
