export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { israelDayBounds } from '@/lib/growth/daily'
import { BASELINE_START, TRIAL_END, TRIAL_FINAL_DATE } from '@/lib/growth/trial'
import { analyzeTrial, type ViewIn, type EventIn, type ScoreIn } from '@/lib/growth/trialAnalysis'
import { trialAdminGate } from '@/lib/growth/trialAdmin'
import { readAll, LIKELY_HUMAN_OR } from '@/lib/analytics/readAll'
import { excludedUsersOrFilter, EXCLUDED_USER_IDS } from '@/lib/analytics-excluded-ids'

// GET /api/admin/growth/trial/results — the December trial's analysis (growth-005), read-only. Reads the baseline
// (Oct 13 – Nov 30) and the trial (Dec 1 – 31, plus each post's 7-day follow-up up to 2027-01-08); all maths in
// lib/growth/trialAnalysis.ts. Human views only (bot_name null, likely-automated signed-out rows left out — the Admin →
// Analytics default), admin + test account excluded from views, events and signups. Signup attribution is approximate.
export async function GET() {
  try {
    const denied = await trialAdminGate()
    if (denied) return denied
    const supabase = createAdminClient()
    const now = new Date()
    const from = israelDayBounds(BASELINE_START).start
    const approvalsEnd = israelDayBounds(TRIAL_END).end
    const viewsEnd = new Date(Math.min(now.getTime(), Date.parse(israelDayBounds(TRIAL_FINAL_DATE).end))).toISOString()

    const [approvals, trialRows, views, events, linkedinDaily] = await Promise.all([
      readAll<{ id: string; article_id: string; platform: string; created_at: string }>('approvals', (a, b) =>
        supabase.from('growth_agent_memory').select('id, article_id, platform, created_at')
          .eq('outcome', 'approved').not('article_id', 'is', null).gte('created_at', from).lt('created_at', approvalsEnd)
          .order('created_at', { ascending: true }).order('id', { ascending: true }).range(a, b)),
      readAll<Record<string, unknown>>('trial rows', (a, b) =>
        supabase.from('growth_trial_posts')
          .select('approval_id, platform, trial_date, variant, utm_campaign, char_count, ends_with_question, li_comments, li_comments_age_hours, li_impressions, li_impressions_age_hours')
          .order('approval_id', { ascending: true }).range(a, b)),
      readAll<ViewIn>('page views', (a, b) =>
        supabase.from('page_views')
          .select('created_at, path, session_id, ip_hash, user_id, utm_source, utm_medium, utm_campaign, referrer, duration_seconds')
          .is('bot_name', null).or(LIKELY_HUMAN_OR).or(excludedUsersOrFilter())
          .or('utm_source.not.is.null,referrer.not.is.null,user_id.not.is.null')
          .gte('created_at', from).lt('created_at', viewsEnd)
          .order('created_at', { ascending: true }).order('id', { ascending: true }).range(a, b)),
      readAll<EventIn>('events', (a, b) =>
        supabase.from('analytics_events').select('event_name, created_at, user_id, ip_hash:detail->>ip_hash')
          .in('event_name', ['wall_shown', 'signup_step_viewed'])
          .is('bot_name', null).or('traffic_class.is.null,traffic_class.neq.suspected_test').or(excludedUsersOrFilter())
          .gte('created_at', israelDayBounds('2026-12-01').start).lt('created_at', viewsEnd)
          .order('created_at', { ascending: true }).order('id', { ascending: true }).range(a, b)),
      readAll<{ metric_date: string; impressions: number | null }>('linkedin daily', (a, b) =>
        supabase.from('linkedin_daily_metrics').select('metric_date, impressions').gte('metric_date', '2025-12-01')
          .order('metric_date', { ascending: true }).range(a, b)),
    ])

    // confirmed accounts created in the window (id + dates only; never emails)
    const signups: { id: string; created_at: string }[] = []
    for (let page = 1; ; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw new Error(`users: ${error.message}`)
      for (const u of data.users) {
        if (!u.email_confirmed_at || EXCLUDED_USER_IDS.includes(u.id)) continue
        if (u.created_at >= from && u.created_at < viewsEnd) signups.push({ id: u.id, created_at: u.created_at })
      }
      if (data.users.length < 1000) break
    }

    // scores + labels of the posted articles
    const ids = [...new Set(approvals.map(a => a.article_id))]
    const scores = new Map<string, ScoreIn>()
    const labels = new Map<string, string[]>()
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const [s, l] = await Promise.all([
        supabase.from('growth_article_scores').select('article_id, practice, talk, wow').in('article_id', chunk),
        supabase.from('articles').select('id, labels').in('id', chunk),
      ])
      if (s.error) throw new Error(`scores: ${s.error.message}`)
      if (l.error) throw new Error(`labels: ${l.error.message}`)
      for (const r of s.data ?? []) scores.set(r.article_id, { practice: r.practice, talk: r.talk, wow: r.wow })
      for (const r of l.data ?? []) labels.set(r.id, r.labels ?? [])
    }

    const result = analyzeTrial({
      now, approvals, trialRows: trialRows as never, views, events, signups, scores, labels, linkedinDaily,
    })
    // per-post rows stay server-side except what the table needs
    const { posts, ...rest } = result
    return NextResponse.json({
      ...rest,
      final: now.getTime() >= Date.parse(israelDayBounds(TRIAL_FINAL_DATE).start),
      generated_at: now.toISOString(),
      trialPosts: posts.filter(p => p.trial).map(p => ({ date: p.date, channel: p.channel, variant: p.variant, mature: p.mature, visits: p.visits, li_comments: p.li_comments, li_impressions: p.li_impressions })),
    })
  } catch (error) {
    console.error('[trial/results] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Failed to build the trial results', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
