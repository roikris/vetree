export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { israelDate } from '@/lib/growth/daily'
import { TRIAL_START, TRIAL_END } from '@/lib/growth/trial'
import { trialAdminGate } from '@/lib/growth/trialAdmin'

// GET /api/admin/growth/trial/today — what 🧪 December Trial starts from (growth-005), read-only: today's trial rows
// (the tab counts a platform as posted only when it has one) and every LinkedIn trial post with its entered numbers
// (the "to record" list). A December approval with no trial row shows up in the results as "outside the trial".
export async function GET() {
  try {
    const denied = await trialAdminGate()
    if (denied) return denied
    const supabase = createAdminClient()
    const today = israelDate(new Date())
    const [todayRes, liRes] = await Promise.all([
      supabase.from('growth_trial_posts').select('approval_id, article_id, platform, variant, trial_date').eq('trial_date', today),
      supabase.from('growth_trial_posts')
        .select('approval_id, article_id, trial_date, variant, li_comments, li_comments_age_hours, li_impressions, li_impressions_age_hours, growth_agent_memory(created_at, posted_url), articles(title)')
        .eq('platform', 'linkedin').gte('trial_date', TRIAL_START).lte('trial_date', TRIAL_END)
        .order('trial_date', { ascending: true }),
    ])
    if (todayRes.error) throw new Error(`today's trial rows: ${todayRes.error.message}`)
    if (liRes.error) throw new Error(`LinkedIn trial rows: ${liRes.error.message}`)
    return NextResponse.json({ date: today, rows: todayRes.data ?? [], linkedin: liRes.data ?? [] })
  } catch (error) {
    console.error('[trial/today] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Failed to load the trial state', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
