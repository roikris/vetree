import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Cache for 1 hour

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Count confirmed users
    const { count: confirmedUsers } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true })
      .not('email_confirmed_at', 'is', null)

    // Count enriched articles
    const { count: articlesCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('needs_enrichment', false)
      .not('clinical_bottom_line', 'is', null)

    return NextResponse.json({
      confirmed_users: confirmedUsers || 0,
      articles_count: articlesCount || 0
    })

  } catch (error) {
    console.error('[public-stats] Error:', error)
    return NextResponse.json({
      confirmed_users: 0,
      articles_count: 0
    }, { status: 200 })
  }
}
