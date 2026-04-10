export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const serverClient = await createClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: role } = await serverClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const [{ data: opportunities }, { data: history }] = await Promise.all([
      supabase
        .from('analytics_opportunities')
        .select('topic, search_count, opportunity_score')
        .eq('status', 'pending')
        .order('opportunity_score', { ascending: false })
        .limit(5),
      supabase
        .from('growth_agent_memory')
        .select('id, synthesis_topic, hook_line, platform, created_at')
        .not('synthesis_topic', 'is', null)
        .eq('outcome', 'approved')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    return NextResponse.json({
      opportunities: opportunities || [],
      history: history || [],
    })
  } catch (error) {
    console.error('[synthesis-opportunities] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
