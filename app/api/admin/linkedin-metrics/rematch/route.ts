import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { matchArticlesToPosts } from '@/lib/linkedin/matchArticle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
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

  // Fetch all unmatched rows (article_id IS NULL, match_method != 'manual')
  const { data: unmatched, error: fetchError } = await supabase
    .from('linkedin_post_metrics')
    .select('id, post_url, post_date')
    .is('article_id', null)
    .or('match_method.is.null,match_method.neq.manual')

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!unmatched?.length) return NextResponse.json({ updated: 0, message: 'No unmatched rows' })

  // Fetch linkedin memory
  const { data: linkedinMemory } = await supabase
    .from('growth_agent_memory')
    .select('id, article_id, hook_line, created_at, posted_url')
    .eq('platform', 'linkedin')
    .eq('outcome', 'approved')

  // Run tiered matcher — key = DB row id
  const postsToMatch = unmatched
    .filter(r => r.post_url)
    .map(r => ({ key: r.id, url: r.post_url!, post_date: r.post_date }))

  const matchMap = await matchArticlesToPosts(postsToMatch, linkedinMemory ?? [])

  // Apply results
  const updates: { id: string; article_id: string; match_method: string }[] = []
  for (const [rowId, match] of matchMap) {
    updates.push({ id: rowId, article_id: match.article_id, match_method: match.method })
  }

  let updated = 0
  for (const upd of updates) {
    const { error } = await supabase
      .from('linkedin_post_metrics')
      .update({ article_id: upd.article_id, match_method: upd.match_method })
      .eq('id', upd.id)
    if (!error) updated++
  }

  return NextResponse.json({
    updated,
    unmatched_total: unmatched.length,
    still_unmatched: unmatched.length - updated,
    breakdown: {
      slug: updates.filter(u => u.match_method === 'slug').length,
      date: updates.filter(u => u.match_method === 'date').length,
      haiku: updates.filter(u => u.match_method === 'haiku').length,
    },
  })
}
