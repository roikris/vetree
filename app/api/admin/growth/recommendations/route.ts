export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rankGrowthCandidates, pickRecommendations, RANKING_POLICY } from '@/lib/growth/candidates'
import { RUBRIC_VERSION } from '@/lib/growth/scoring'

// GET /api/admin/growth/recommendations — 9 top picks of the shared Growth OS ranking + 1 low-ranked
// wildcard (lib/growth/candidates.ts; same pool the daily auto-pick draws from). Scores up to 50
// not-yet-scored articles first, within 30s. Every served set is logged to
// growth_recommendation_sets so later approvals/dismissals can be traced to what was shown.
export async function GET() {
  const startedAt = Date.now()
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

    const { ranked, degraded, scoredCount, scoringErrors } = await rankGrowthCandidates(supabase, {
      scoreMissing: { max: 50, deadline: startedAt + 30_000 },
    })
    const recommendations = pickRecommendations(ranked)

    const { error: logError } = await supabase.from('growth_recommendation_sets').insert({
      rubric_version: RUBRIC_VERSION,
      ranking_policy: RANKING_POLICY,
      eligible_count: ranked.length,
      scored_count: scoredCount,
      items: recommendations.map((r, i) => ({
        article_id: r.id,
        position: i + 1,
        pool_rank: r.poolRank,
        wildcard: r.wildcard,
        crowd_favorite: r.crowdFavorite,
        scores: r.scores ? { practice: r.scores.practice, talk: r.scores.talk, wow: r.scores.wow } : null,
      })),
    })
    if (logError) console.error('[growth/recommendations] set log failed:', logError.message)

    return NextResponse.json({
      recommendations,
      eligible_count: ranked.length,
      scored_count: scoredCount,
      degraded,
      scoring_errors: scoringErrors.length,
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
