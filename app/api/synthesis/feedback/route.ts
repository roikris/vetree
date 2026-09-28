export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { normalizeQuery } from '@/lib/utils/normalizeQuery'
import { detectBotName } from '@/lib/bot-detection'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, feedback, feedback_note } = body

    if (!query || !feedback) {
      return NextResponse.json(
        { error: 'Query and feedback are required' },
        { status: 400 }
      )
    }

    if (!['helpful', 'not_relevant'].includes(feedback)) {
      return NextResponse.json(
        { error: 'Invalid feedback value' },
        { status: 400 }
      )
    }

    // Same exclusions as /api/analytics/track: QA smoke traffic is never recorded, and crawlers
    // have no business voting (experiment KPI).
    const userAgent = request.headers.get('user-agent') || ''
    if (userAgent.includes('VetreeQABot') || request.headers.get('x-qa-bot') === '1' || detectBotName(userAgent)) {
      return NextResponse.json({ success: true, tracked: false })
    }

    const queryNormalized = normalizeQuery(query)

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get current user ID if authenticated
    const { createClient } = await import('@/lib/supabase/server')
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    const userId = user?.id || null

    // One vote per signed-in reader per topic per 7 days (the synthesis cache lifetime). Guests
    // are limited client-side (one vote per topic per session, no double submission).
    if (userId) {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
      const { count, error: dupError } = await supabase
        .from('synthesis_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('query_normalized', queryNormalized).gte('created_at', since)
      if (dupError) {
        console.error('[synthesis-feedback] Duplicate check failed:', dupError)
        return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
      }
      if ((count ?? 0) > 0) return NextResponse.json({ success: true, duplicate: true })
    }

    const { error } = await supabase
      .from('synthesis_feedback')
      .insert({
        query_normalized: queryNormalized,
        feedback,
        feedback_note: feedback_note || null,
        user_id: userId
      })

    if (error) {
      console.error('[synthesis-feedback] Error:', error)
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[synthesis-feedback] Error:', error)
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    )
  }
}
