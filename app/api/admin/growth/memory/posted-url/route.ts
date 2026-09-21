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

/**
 * GET /api/admin/growth/memory/posted-url
 * Lists every approved LinkedIn memory row still missing a posted_url —
 * regardless of date — so the UI can remind the admin retroactively, not
 * just in the same session where it was marked posted.
 */
export async function GET() {
  const cookieClient = await createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: roleData } = await cookieClient
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: rows, error } = await supabase
    .from('growth_agent_memory')
    .select('id, article_id, created_at')
    .eq('platform', 'linkedin')
    .eq('outcome', 'approved')
    .is('posted_url', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows?.length) return NextResponse.json({ rows: [] })

  const articleIds = [...new Set(rows.map(r => r.article_id).filter(Boolean))]
  const { data: articles } = await supabase
    .from('articles')
    .select('id, title')
    .in('id', articleIds)
  const titleById = new Map((articles ?? []).map(a => [a.id, a.title]))

  return NextResponse.json({
    rows: rows.map(r => ({
      id: r.id,
      article_id: r.article_id,
      article_title: r.article_id ? titleById.get(r.article_id) ?? null : null,
      date: r.created_at.slice(0, 10),
      created_at: r.created_at,
    })),
  })
}

export async function PATCH(request: NextRequest) {
  const cookieClient = await createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: roleData } = await cookieClient
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { id, article_id, platform, date, posted_url } = body

  if (!posted_url || (!id && (!article_id || !platform || !date))) {
    return NextResponse.json({ error: 'posted_url and either id, or article_id+platform+date, are required' }, { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let targetId = id

  if (!targetId) {
    // No row id supplied (session-save flows right after posting) — derive it.
    // Multiple approved rows can exist for the same article+platform+day (no unique
    // constraint), so scope to the one still missing a URL rather than "most recent",
    // which could silently overwrite an already-saved sibling row.
    const dayStart = `${date}T00:00:00.000Z`
    const dayEnd = `${date}T23:59:59.999Z`

    const { data: rows } = await supabase
      .from('growth_agent_memory')
      .select('id')
      .eq('article_id', article_id)
      .eq('platform', platform)
      .eq('outcome', 'approved')
      .is('posted_url', null)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!rows?.length) {
      return NextResponse.json({ error: 'No approved memory row still missing a posted_url for this article/platform/date' }, { status: 500 })
    }
    targetId = rows[0].id
  }

  const { error } = await supabase
    .from('growth_agent_memory')
    .update({ posted_url })
    .eq('id', targetId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, memory_id: targetId })
}
