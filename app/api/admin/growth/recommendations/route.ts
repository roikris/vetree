export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rankGrowthCandidates } from '@/lib/growth/candidates'

// GET /api/admin/growth/recommendations — top 10 of the shared Growth OS ranking
// (lib/growth/candidates.ts; same pool the daily auto-pick draws from).
export async function GET() {
  try {
    const serverClient = await createClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: role } = await serverClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    if (role?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const ranked = await rankGrowthCandidates(supabase)
    return NextResponse.json({
      recommendations: ranked.slice(0, 10),
      eligible_count: ranked.length,
    })
  } catch (error: any) {
    console.error('[growth/recommendations] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load recommendations', details: String(error) },
      { status: 500 }
    )
  }
}

// POST /api/admin/growth/recommendations
// Dismiss a recommendation as 'irrelevant' or 'already_published'
// Stored in growth_agent_memory so it's excluded from future recommendations
export async function POST(request: NextRequest) {
  try {
    const serverClient = await createClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: role } = await serverClient
      .from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { article_id, outcome } = await request.json()

    if (!article_id || !['irrelevant', 'already_published'].includes(outcome)) {
      return NextResponse.json(
        { error: 'article_id and outcome (irrelevant|already_published) required' },
        { status: 400 }
      )
    }

    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('growth_agent_memory')
      .insert({
        article_id,
        outcome,
        platform: 'recommendations',
        language: 'en',
      })

    if (error) {
      console.error('[recs] dismiss insert error:', error)
      return NextResponse.json({ error: 'Failed to dismiss', details: error.message }, { status: 500 })
    }

    console.log(`[recs] dismissed article ${article_id} as ${outcome}`)
    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[growth/recommendations POST] Error:', error)
    return NextResponse.json({ error: 'Failed to dismiss', details: String(error) }, { status: 500 })
  }
}
