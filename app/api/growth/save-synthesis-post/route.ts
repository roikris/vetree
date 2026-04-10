export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (!userRole || userRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { synthesis_topic, hook_line, platform, language } = body

    if (!synthesis_topic || !platform || !language) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error: insertError } = await supabase.from('growth_agent_memory').insert({
      article_id: null,
      platform,
      language,
      outcome: 'approved',
      hook_line: hook_line || null,
      synthesis_topic,
    })

    if (insertError) {
      console.error('[save-synthesis-post] Error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save post', details: insertError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[save-synthesis-post] Error:', error)
    return NextResponse.json(
      { error: 'Failed to save post', details: String(error) },
      { status: 500 },
    )
  }
}
