export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (token !== process.env.DIGEST_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Load last 7 snapshots
    const { data: snapshots } = await supabase
      .from('analytics_daily_snapshot')
      .select('*')
      .order('date', { ascending: false })
      .limit(7)

    const latest = snapshots?.[0]
    const previous = snapshots?.[1]
    const signals: any[] = []

    if (latest) {
      // Signal 1: High zero-result rate
      if (latest.zero_result_rate > 0.3) {
        signals.push({
          date: latest.date,
          type: 'search_gap',
          severity: Math.min(latest.zero_result_rate, 1.0),
          description: `${Math.round(latest.zero_result_rate * 100)}% of searches return zero results this week`,
          data_json: { rate: latest.zero_result_rate, count: latest.zero_result_searches }
        })
      }

      // Signal 2: Specific zero-result queries (content gaps)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: zeroSearches } = await supabase
        .from('search_logs')
        .select('query, results_count')
        .eq('results_count', 0)
        .gte('created_at', sevenDaysAgo)

      const zeroQueryCounts = zeroSearches?.reduce((acc, s) => {
        acc[s.query] = (acc[s.query] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const topZeroQueries = Object.entries(zeroQueryCounts || {})
        .filter(([, count]) => count >= 2)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)

      for (const [query, count] of topZeroQueries) {
        signals.push({
          date: latest.date,
          type: 'content_opportunity',
          severity: Math.min(count / 10, 0.95),
          description: `"${query}" searched ${count}x with zero results — unmet clinical demand`,
          data_json: { query, search_count: count, results: 0 }
        })

        // Also add to opportunities table
        await supabase.from('analytics_opportunities').upsert({
          topic: query,
          search_count: count,
          zero_result_rate: 1.0,
          opportunity_score: count / 10
        }, { onConflict: 'topic' })
      }

      // Signal 3: DAU/MAU ratio (stickiness)
      if (latest.mau && latest.mau > 0) {
        const stickiness = (latest.dau || 0) / latest.mau
        if (stickiness < 0.1) {
          signals.push({
            date: latest.date,
            type: 'retention_driver',
            severity: 0.8 - stickiness,
            description: `DAU/MAU ratio is ${Math.round(stickiness * 100)}% — low stickiness`,
            data_json: { dau: latest.dau, mau: latest.mau, ratio: stickiness }
          })
        }
      }

      // Signal 4: WoW DAU change
      if (previous && previous.dau && latest.dau) {
        const change = (latest.dau - previous.dau) / previous.dau
        if (Math.abs(change) > 0.2) {
          signals.push({
            date: latest.date,
            type: change > 0 ? 'growth_signal' : 'retention_driver',
            severity: Math.min(Math.abs(change), 1.0),
            description: `DAU ${change > 0 ? 'increased' : 'dropped'} ${Math.round(Math.abs(change) * 100)}% vs yesterday`,
            data_json: { today: latest.dau, yesterday: previous.dau, change_pct: change }
          })
        }
      }

      // Signal 5: Low synthesis helpfulness
      const totalFeedback = (latest.synthesis_helpful || 0) + (latest.synthesis_not_relevant || 0)
      if (totalFeedback >= 3) {
        const helpfulRate = (latest.synthesis_helpful || 0) / totalFeedback
        if (helpfulRate < 0.5) {
          signals.push({
            date: latest.date,
            type: 'ux_problem',
            severity: 1 - helpfulRate,
            description: `Synthesis helpful rate is only ${Math.round(helpfulRate * 100)}% this week`,
            data_json: { helpful: latest.synthesis_helpful, not_relevant: latest.synthesis_not_relevant }
          })
        }
      }
    }

    // Check for churned users (not seen in 7+ days)
    const sevenDaysAgoDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const adminId = '90cb8294-b593-4144-a9f5-23ca52dd5e35'

    // Users active before 7 days ago but not since
    const { data: recentUsers } = await supabase
      .from('page_views')
      .select('user_id')
      .gte('created_at', sevenDaysAgoDate)
      .not('user_id', 'is', null)
      .neq('user_id', adminId)

    const recentUserIds = new Set(recentUsers?.map(u => u.user_id))

    const { data: olderUsers } = await supabase
      .from('page_views')
      .select('user_id')
      .gte('created_at', fourteenDaysAgo)
      .lt('created_at', sevenDaysAgoDate)
      .not('user_id', 'is', null)
      .neq('user_id', adminId)

    const churnedUserIds = [...new Set(olderUsers?.map(u => u.user_id) || [])]
      .filter(id => !recentUserIds.has(id))

    if (churnedUserIds.length > 0) {
      signals.push({
        date: new Date().toISOString().split('T')[0],
        type: 'churn_risk',
        severity: Math.min(churnedUserIds.length / 5, 1.0),
        description: `${churnedUserIds.length} user(s) active last week but not seen in 7+ days`,
        data_json: { churned_user_ids: churnedUserIds, count: churnedUserIds.length }
      })
    }

    // Save signals (delete today's first, then insert fresh)
    const todayDate = new Date().toISOString().split('T')[0]
    await supabase.from('analytics_signals').delete().eq('date', todayDate)

    if (signals.length > 0) {
      const { error } = await supabase.from('analytics_signals').insert(signals)
      if (error) {
        console.error('[analytics/signals] Insert error:', error)
      }
    }

    return NextResponse.json({ success: true, signals_count: signals.length, signals })

  } catch (error) {
    console.error('[analytics/signals] Error:', error)
    return NextResponse.json(
      { error: 'Failed to extract signals' },
      { status: 500 }
    )
  }
}
