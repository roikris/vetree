import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { israelDate, israelDayBounds, israelDateMinus, postingStreak, type ApprovedRow } from '@/lib/growth/daily'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/growth/today — what Growth OS's daily panel starts from (growth-002): today's "posted" rows (Israel
// day) and the posting streak, from growth_agent_memory instead of one browser's localStorage. Read-only. The day's
// article = the newest approved row today (lib/growth/daily.ts reconcileDay); its title comes along for the header.
const STREAK_WINDOW_DAYS = 120 // the window holds today + 120 days; a longer streak is reported as 120, capped
const PAGE = 1000
const MAX_ROWS = 20_000 // a bound on the paging, far above 6 platforms × 121 days

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

    // the streak window, page by page (PostgREST returns at most 1000 rows per request)
    const recentDays = async () => {
      const days = new Set<string>()
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from('growth_agent_memory')
          .select('created_at')
          .eq('outcome', 'approved').not('article_id', 'is', null)
          .gte('created_at', since).lt('created_at', end)
          .order('created_at', { ascending: false }).order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw new Error(`recent rows: ${error.message}`)
        for (const r of data ?? []) days.add(israelDate(r.created_at))
        if (!data || data.length < PAGE) return days
        if (from + PAGE >= MAX_ROWS) throw new Error(`more than ${MAX_ROWS} approved rows in ${STREAK_WINDOW_DAYS} days`)
      }
    }
    const [todayRes, days] = await Promise.all([
      supabase.from('growth_agent_memory')
        .select('id, article_id, platform, created_at, posted_url')
        .eq('outcome', 'approved').not('article_id', 'is', null)
        .gte('created_at', start).lt('created_at', end)
        .order('created_at', { ascending: true }),
      recentDays(),
    ])
    if (todayRes.error) throw new Error(`today's rows: ${todayRes.error.message}`)

    const rows = (todayRes.data ?? []) as ApprovedRow[]
    const streak = postingStreak(days, today)

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
      streak: Math.min(streak, STREAK_WINDOW_DAYS),
      streak_capped: streak > STREAK_WINDOW_DAYS,
      days_posted: days.size,
      window_days: STREAK_WINDOW_DAYS,
    })
  } catch (error) {
    console.error('[growth/today] Error:', error)
    return NextResponse.json({ error: 'Failed to load today', details: String(error) }, { status: 500 })
  }
}
