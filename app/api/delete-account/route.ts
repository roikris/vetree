import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { deleteAccountLimiter, getClientIP } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const ip = getClientIP(request)
    const { success } = await deleteAccountLimiter.limit(ip)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Auth: verify the requesting user is authenticated (reads session from cookies)
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Service role client for deletion operations — bypasses RLS so we can
    // delete from all user-owned tables regardless of policy configuration.
    // GDPR Art. 17 / Israeli Privacy Protection Law § 11: right to erasure.
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const userId = user.id

    // Delete all user PII from every table that stores user-identifiable data.
    // Order: analytics/logs first (no FK deps), then preferences/consent, then
    // social features, then reports, then roles, and finally the auth record.
    const deletions: Array<{ table: string; error: unknown }> = []

    const tables = [
      'page_views',
      'search_logs',
      'user_preferences',
      'user_consents',
      'synthesis_feedback',
      'followed_tags',
      'saved_articles',
      'reports',
      'user_roles',
    ]

    for (const table of tables) {
      const { error } = await adminSupabase
        .from(table)
        .delete()
        .eq('user_id', userId)
      if (error) deletions.push({ table, error })
    }

    if (deletions.length > 0) {
      console.error('[delete-account] Table deletion errors:', deletions)
      return NextResponse.json(
        { error: 'Failed to delete account data. Please try again.' },
        { status: 500 }
      )
    }

    // Delete the auth.users record (and any Supabase-managed cascades)
    const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('[delete-account] Auth deletion error:', authDeleteError)
      return NextResponse.json(
        { error: 'Failed to delete account. Please try again.' },
        { status: 500 }
      )
    }

    // Sign out the session (belt-and-suspenders — user record is already gone)
    await supabase.auth.signOut()

    return NextResponse.json(
      { success: true, message: 'Account deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('[delete-account] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
