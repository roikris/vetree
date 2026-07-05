/**
 * PATCH /api/admin/growth/memory/posted-url
 * Saves the LinkedIn URL to the growth_agent_memory row for a given
 * article + platform + date, enabling activity_id-based matching later.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function PATCH(request: NextRequest) {
  const cookieClient = await createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: roleData } = await cookieClient
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { article_id, platform, date, posted_url } = body

  if (!article_id || !platform || !date || !posted_url) {
    return NextResponse.json({ error: 'article_id, platform, date, posted_url required' }, { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find the most recent approved memory row for this article+platform on this date
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`

  const { data: rows } = await supabase
    .from('growth_agent_memory')
    .select('id')
    .eq('article_id', article_id)
    .eq('platform', platform)
    .eq('outcome', 'approved')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!rows?.length) {
    return NextResponse.json({ error: 'No approved memory row found for this article/platform/date' }, { status: 500 })
  }

  const { error } = await supabase
    .from('growth_agent_memory')
    .update({ posted_url })
    .eq('id', rows[0].id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, memory_id: rows[0].id })
}
