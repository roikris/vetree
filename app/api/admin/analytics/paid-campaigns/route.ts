import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { excludedUsersOrFilter } from '@/lib/analytics-excluded-ids'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type CampaignRow = {
  utm_source: string
  utm_campaign: string
  utm_id: string
  visits: number
  unique_visitors: number
}

type DailyRow = {
  date: string
  visits: number
}

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

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  // Paid traffic only — utm_medium=paid-social distinguishes ad clicks from
  // organic shares, which use utm_medium=social on the same utm_source
  // (e.g. LinkedIn organic posts vs LinkedIn ads both have utm_source=linkedin).
  let query = supabase
    .from('page_views')
    .select('utm_source, utm_campaign, utm_id, ip_hash, user_id, created_at')
    .eq('utm_medium', 'paid-social')
    .is('bot_name', null) // AdsBot-Google re-fetches the exact ad-clicked URL (utm_id
                            // included) to verify the landing page — without this it
                            // looks like a real paid click
    .or(excludedUsersOrFilter())

  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59Z')

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const campaignKey = (r: { utm_source: string | null; utm_campaign: string | null; utm_id: string | null }) =>
    `${r.utm_source ?? '(none)'}|${r.utm_campaign ?? '(none)'}|${r.utm_id ?? '(none)'}`

  const visitorsByCampaign: Record<string, Set<string>> = {}
  const visitsByCampaign: Record<string, number> = {}
  const visitsByDay: Record<string, number> = {}

  for (const r of rows || []) {
    const key = campaignKey(r)
    visitsByCampaign[key] = (visitsByCampaign[key] || 0) + 1
    if (!visitorsByCampaign[key]) visitorsByCampaign[key] = new Set()
    visitorsByCampaign[key].add(r.user_id || r.ip_hash || 'anon')

    const day = r.created_at?.slice(0, 10)
    if (day) visitsByDay[day] = (visitsByDay[day] || 0) + 1
  }

  const campaigns: CampaignRow[] = Object.keys(visitsByCampaign).map(key => {
    const [utm_source, utm_campaign, utm_id] = key.split('|')
    return {
      utm_source,
      utm_campaign,
      utm_id,
      visits: visitsByCampaign[key],
      unique_visitors: visitorsByCampaign[key].size,
    }
  }).sort((a, b) => b.visits - a.visits)

  const daily_trend: DailyRow[] = Object.keys(visitsByDay)
    .sort()
    .map(date => ({ date, visits: visitsByDay[date] }))

  const totals = {
    visits: campaigns.reduce((sum, c) => sum + c.visits, 0),
    unique_visitors: new Set(
      Object.values(visitorsByCampaign).flatMap(s => [...s])
    ).size,
  }

  return NextResponse.json({ campaigns, daily_trend, totals })
}
