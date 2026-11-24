import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params
  const body = await request.json()
  const { article_id, match_method, impressions, engagements, action } = body

  // Metrics update — inline edit of impressions / engagements
  if ('impressions' in body || 'engagements' in body) {
    const updates: Record<string, unknown> = { metrics_updated_at: new Date().toISOString() }
    if ('impressions' in body && (!Number.isInteger(impressions) || impressions < 0))
      return NextResponse.json({ error: 'impressions must be a non-negative integer' }, { status: 400 })
    if ('engagements' in body && (!Number.isInteger(engagements) || engagements < 0))
      return NextResponse.json({ error: 'engagements must be a non-negative integer' }, { status: 400 })
    // A number typed in by hand is the one on the post's own LinkedIn page — all time, up to today (analytics-002):
    // its range is the post date → today, so it never shows as an undercount.
    const { data: row, error: rowError } = await supabase
      .from('linkedin_post_metrics').select('post_date').eq('id', id).maybeSingle()
    if (rowError) return NextResponse.json({ error: rowError.message }, { status: 500 })
    if (!row) return NextResponse.json({ error: 'Row not found' }, { status: 500 })
    const today = new Date().toISOString().slice(0, 10)
    if ('impressions' in body) {
      updates.impressions = impressions
      updates.impressions_period_start = row.post_date
      updates.impressions_period_end = today
    }
    if ('engagements' in body) {
      updates.engagements = engagements
      updates.engagements_period_start = row.post_date
      updates.engagements_period_end = today
    }
    const { error } = await supabase
      .from('linkedin_post_metrics')
      .update(updates)
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Clear an erroneous match — distinct from 'no_article': this row is
  // "unknown, needs assignment" and is excluded from automatic rematch
  // (see rematch/route.ts) so the same wrong tier match can't reapply itself.
  if (action === 'clear_match') {
    const { data: existing, error: fetchError } = await supabase
      .from('linkedin_post_metrics')
      .select('article_id, match_method')
      .eq('id', id)
      .single()
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

    const { data: updated, error } = await supabase
      .from('linkedin_post_metrics')
      .update({ article_id: null, match_method: 'cleared' })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    console.log(
      `[linkedin-metrics] clear_match row=${id} previous_article_id=${existing?.article_id ?? 'null'} previous_match_method=${existing?.match_method ?? 'null'}`
    )

    return NextResponse.json({ success: true, row: updated })
  }

  if (match_method === 'no_article') {
    const { error } = await supabase
      .from('linkedin_post_metrics')
      .update({ match_method: 'no_article' })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (!article_id) return NextResponse.json({ error: 'article_id or match_method=no_article required' }, { status: 400 })

  const { error } = await supabase
    .from('linkedin_post_metrics')
    .update({ article_id, match_method: 'manual' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: role } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { error } = await supabase
    .from('linkedin_post_metrics')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
