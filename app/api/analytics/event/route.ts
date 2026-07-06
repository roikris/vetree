import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_name, article_id } = body

    if (!event_name || typeof event_name !== 'string') {
      return NextResponse.json({ success: false })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Skip admin events — same pattern as /api/analytics/track
    if (user) {
      const { data: role } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id).single()
      if (role?.role === 'admin') {
        return NextResponse.json({ success: true, tracked: false })
      }
    }

    await supabase.from('analytics_events').insert({
      event_name,
      article_id: article_id || null,
      user_id: user?.id || null,
    })

    return NextResponse.json({ success: true })
  } catch {
    // Never fail the caller — fire-and-forget
    return NextResponse.json({ success: false })
  }
}
