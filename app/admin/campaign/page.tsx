import { createClient } from '@supabase/supabase-js'
import { CampaignClient } from './CampaignClient'
import { excludedUsersOrFilter } from '@/lib/analytics-excluded-ids'
import { EXPERIMENT_KICKOFF_DATE, EXPERIMENT_END_DATE } from '@/lib/synthesis/experiment'

// Run 2 of the auto-run experiment. Run 1 (2026-06-20 → 2026-09-18) is not comparable: its
// /synthesis/run and engaged counts included CI smoke traffic, and the synthesis cache never
// stored (missing search_version column, migration 063), so every run was a fresh generation.
const KICKOFF_DATE = EXPERIMENT_KICKOFF_DATE
const END_DATE = EXPERIMENT_END_DATE  // day 90, inclusive
// Snapshot metrics are rolling windows (7-day counts; 30-day MAU), so until kickoff + 30 days
// they still contain run-1 days: the verdict waits for that, and the synthesis KPIs come from
// raw events scoped exactly to [KICKOFF_DATE, END_DATE] instead of snapshots.
const WARMUP_DAYS = 30
// Baseline stays the pre-experiment month (no auto-run; synthesis was a manual button), not the
// 30 days before run 2, which were run 1 itself. The cache was already failing then (since
// 2026-05-18): synthesis latency was higher, which may slightly affect session duration.
const BASELINE_START = '2026-05-21'
const BASELINE_END = '2026-06-19'

type SnapshotRow = {
  date: string
  dau: number
  wau: number
  mau: number
  registered_mau: number
  total_searches: number
  zero_result_searches: number
  synthesis_runs: number
  synthesis_engaged: number
  synthesis_helpful: number
  articles_saved: number
  avg_session_duration_seconds: number
  median_session_duration_seconds: number
  traffic_sources: Record<string, number>
}

function avg(rows: SnapshotRow[], key: keyof SnapshotRow): number {
  const vals = rows
    .map(r => r[key] as number)
    .filter(v => v != null && !isNaN(v))
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

export default async function CampaignPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('analytics_daily_snapshot')
    .select('date, dau, wau, mau, registered_mau, total_searches, zero_result_searches, synthesis_runs, synthesis_engaged, synthesis_helpful, articles_saved, avg_session_duration_seconds, median_session_duration_seconds, traffic_sources')
    .gte('date', BASELINE_START)
    .order('date', { ascending: true })

  const rows: SnapshotRow[] = (data || []).map(r => ({
    ...r,
    synthesis_engaged: r.synthesis_engaged ?? 0,
    traffic_sources: r.traffic_sources ?? {},
  }))

  const baselineRows = rows.filter(r => r.date <= BASELINE_END)
  const experimentRows = rows.filter(r => r.date >= KICKOFF_DATE && r.date <= END_DATE)
  const today = experimentRows[experimentRows.length - 1] ?? null

  const baselineMedianSession = avg(baselineRows, 'median_session_duration_seconds')
  // registered_mau was 0 in historical snapshots before migration 025 added the column.
  // Only average rows where the value was actually populated to avoid baseline pollution.
  const baselineRegisteredMau = avg(baselineRows.filter(r => (r.registered_mau ?? 0) > 0), 'registered_mau')
  const baselineDau = avg(baselineRows, 'dau')
  const baselineMau = avg(baselineRows, 'mau')
  const baselineTotalSearches = avg(baselineRows, 'total_searches')
  const baselineSynthesisRuns = avg(baselineRows, 'synthesis_runs')

  const baseline = {
    median_session: baselineMedianSession,
    registered_mau: baselineRegisteredMau,
    dau_mau_ratio: baselineMau > 0 ? (baselineDau / baselineMau) * 100 : 0,
    total_searches: baselineTotalSearches,
    synthesis_runs: baselineSynthesisRuns,
    // synthesis_engaged baseline is 0 — new metric introduced with this experiment
    synthesis_engaged: 0,
    // Average baseline snapshot per source (each snapshot is a 7-day window), comparable with
    // the latest experiment snapshot
    traffic_sources: Object.fromEntries(Object.entries(baselineRows.reduce((acc, r) => {
      Object.entries(r.traffic_sources ?? {}).forEach(([src, count]) => {
        acc[src] = (acc[src] ?? 0) + (count as number)
      })
      return acc
    }, {} as Record<string, number>)).map(([src, total]) => [src, total / Math.max(1, baselineRows.length)])),
  }

  const DAY = 24 * 60 * 60 * 1000
  const kickoff = new Date(`${KICKOFF_DATE}T00:00:00Z`)
  const nowDate = today ? new Date(`${today.date}T00:00:00Z`) : new Date()
  const dayNumber = Math.min(90, Math.max(1, Math.floor((nowDate.getTime() - kickoff.getTime()) / DAY) + 1))
  const warmupUntil = new Date(kickoff.getTime() + WARMUP_DAYS * DAY).toISOString().slice(0, 10)
  const warmingUp = !today || today.date < warmupUntil

  // Synthesis KPIs from raw events, exactly within the run-2 window (humans only: crawlers are
  // tagged bot_name; QA traffic is never recorded; admin + TEST_USER_ID excluded)
  const from = `${KICKOFF_DATE}T00:00:00Z`
  const to = new Date(new Date(`${END_DATE}T00:00:00Z`).getTime() + DAY).toISOString()
  const countEvents = async (path: string) => {
    const { count, error } = await supabase.from('page_views')
      .select('id', { count: 'exact', head: true })
      .eq('path', path).is('bot_name', null).or(excludedUsersOrFilter())
      .gte('created_at', from).lt('created_at', to)
    if (error) throw new Error(`campaign ${path} count failed: ${error.message}`)
    return count ?? 0
  }
  const countFeedback = async (feedback: string) => {
    const { count, error } = await supabase.from('synthesis_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('feedback', feedback).or(excludedUsersOrFilter())
      .gte('created_at', from).lt('created_at', to)
    if (error) throw new Error(`campaign feedback count failed: ${error.message}`)
    return count ?? 0
  }
  const [attempts, clientErrors, runs, engaged, blocked, insufficient, failed, busyTimeout, helpful, notRelevant] = await Promise.all([
    countEvents('/synthesis/attempt'), countEvents('/synthesis/client_error'),
    countEvents('/synthesis/run'), countEvents('/synthesis/engaged'), countEvents('/synthesis/blocked'),
    countEvents('/synthesis/insufficient'), countEvents('/synthesis/failed'), countEvents('/synthesis/busy_timeout'),
    countFeedback('helpful'), countFeedback('not_relevant'),
  ])
  const run2 = { attempts, runs, engaged, blocked, insufficient, failed: failed + busyTimeout + clientErrors, helpful, notRelevant }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F] p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          Synthesis Experiment
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          90-day auto-run experiment, run 2 — {KICKOFF_DATE} to {END_DATE}
        </p>
      </div>

      <CampaignClient
        allRows={rows}
        baseline={baseline}
        today={today}
        dayNumber={dayNumber}
        kickoffDate={KICKOFF_DATE}
        endDate={END_DATE}
        run2={run2}
        warmingUp={warmingUp}
        warmupUntil={warmupUntil}
      />
    </div>
  )
}
