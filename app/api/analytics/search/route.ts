import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getClientIP } from '@/lib/ratelimit'
import { hashIP } from '@/lib/ipHash'
import { EXCLUDED_USER_IDS } from '@/lib/analytics-excluded-ids'
import { analyticsRecordingEnabled, isQATraffic } from '@/lib/analytics/recording'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { query, results_count, results_count_is_lower_bound } = body

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Don't log single character searches
    if (query.trim().length < 2) {
      return NextResponse.json({ success: true })
    }

    // Only the production deployment records (previews and local dev share the production DB);
    // skip QA bot traffic — VetreeQABot UA or x-qa-bot header
    const userAgent = request.headers.get('user-agent') || ''
    if (!analyticsRecordingEnabled() || isQATraffic(userAgent, request.headers)) {
      return NextResponse.json({ success: true })
    }

    // Get user if logged in
    const { data: { user } } = await supabase.auth.getUser()

    // Don't log excluded users (admin + test account)
    if (user?.id && EXCLUDED_USER_IDS.includes(user.id)) {
      return NextResponse.json({ success: true })
    }

    // Get IP from headers (privacy-conscious: we'll hash it)
    const ip = getClientIP(request)

    // Hash IP for privacy (never store raw IP)
    const ipHash = hashIP(ip)

    // Insert search log — with the service role: the public key cannot insert into search_logs
    // (since migration 078, infra-002), so rows only arrive through this route's filters (QA, excluded users)
    const { error } = await createAdminClient()
      .from('search_logs')
      .insert({
        query: query.trim(),
        results_count: results_count || 0,
        // Progressive search logs its first batch: true means "at least results_count"
        results_count_is_lower_bound: results_count_is_lower_bound === true,
        user_id: user?.id || null,
        ip_hash: ipHash
      })

    if (error) {
      console.error('[analytics] Error inserting search log:', error)
      // Don't fail the request if analytics fails
      return NextResponse.json({ success: false }, { status: 200 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[analytics] Error tracking search:', error)
    // Don't fail the request if analytics fails
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
