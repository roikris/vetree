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
    // Account deletion (Privacy Policy §7; GDPR Art. 17 where it applies). Distinct from the
    // statutory correction/deletion right under §14 of the Israeli Protection of Privacy Law.
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
      'analytics_events',   // funnel + synthesis events (user_id FK is ON DELETE SET NULL — delete explicitly)
      'digest_logs',        // which digests were sent to this person
      'user_preferences',
      'user_consents',
      'synthesis_feedback',
      'followed_tags',
      'saved_articles',
      'reports',
      'user_roles',
    ]

    // The person's cached syntheses (their search text and generated content) are deleted, not just
    // unlinked; the cache regenerates on demand (migration 070)
    {
      const { error } = await adminSupabase.from('topic_syntheses').delete().eq('user_id', userId)
      if (error) deletions.push({ table: 'topic_syntheses', error })
    }

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
    // The uploaded profile picture (private avatars bucket, {userId}/…). Must go BEFORE the auth
    // user: Supabase refuses to delete a user who still owns Storage objects.
    const { data: avatarFiles, error: avatarListError } = await adminSupabase.storage.from('avatars').list(userId)
    if (avatarListError) {
      console.error('[delete-account] avatar list error:', avatarListError)
      return NextResponse.json({ error: 'Failed to delete account data. Please try again.' }, { status: 500 })
    }
    if (avatarFiles && avatarFiles.length > 0) {
      const { error: avatarRemoveError } = await adminSupabase.storage.from('avatars')
        .remove(avatarFiles.map(f => `${userId}/${f.name}`))
      if (avatarRemoveError) {
        console.error('[delete-account] avatar remove error:', avatarRemoveError)
        return NextResponse.json({ error: 'Failed to delete account data. Please try again.' }, { status: 500 })
      }
    }

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
