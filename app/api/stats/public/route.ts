import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { EXCLUDED_USER_IDS } from '@/lib/analytics-excluded-ids'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public counts, cached for an hour: a public endpoint must not make the server list every user
// (or count every article) on each request. Errors are thrown, so they are never cached.
const getPublicStats = unstable_cache(async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Publicly visible articles (same filter as the feed)
  const { count: articlesCount, error: articlesError } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', false)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')
  if (articlesError) throw new Error(`articles count: ${articlesError.message}`)

  // Confirmed accounts, excluding the admin and the smoke-test account. auth.users is not reachable
  // through PostgREST (.from('auth.users') always failed, so this was 0 until 2026-10-04) — use the
  // auth admin API.
  let confirmedUsers = 0
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`users count: ${error.message}`)
    confirmedUsers += data.users.filter(u => u.email_confirmed_at && !EXCLUDED_USER_IDS.includes(u.id)).length
    if (data.users.length < 1000) break
  }

  return { confirmed_users: confirmedUsers, articles_count: articlesCount ?? 0 }
}, ['public-stats-v2'], { revalidate: 3600 })

export async function GET() {
  try {
    return NextResponse.json(await getPublicStats())
  } catch (error) {
    // A data error is a 500 (CLAUDE.md rule 6) — never zeros that look like real counts
    console.error('[public-stats] Error:', error)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
