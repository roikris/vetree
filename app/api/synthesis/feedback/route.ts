export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { normalizeQuery } from '@/lib/utils/normalizeQuery'

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
