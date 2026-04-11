export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in to submit a report' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const { type, articleId, description } = body

    if (!type || !description?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error } = await supabase
      .from('reports')
      .insert({
        user_id: user.id,
        type,
        article_id: articleId || null,
        description,
        status: 'open',
      })

    if (error) {
      console.error('[reports] Error inserting report:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[reports] Error:', error)
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
  }
}
