import { createClient } from '@supabase/supabase-js'
import { CampaignClient } from './CampaignClient'

const KICKOFF_DATE = '2026-06-20'
const END_DATE = '2026-09-18'
const BASELINE_START = '2026-05-21'

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

  const baselineRows = rows.filter(r => r.date < KICKOFF_DATE)
  const experimentRows = rows.filter(r => r.date >= KICKOFF_DATE)
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
    // Aggregate baseline traffic sources
    traffic_sources: baselineRows.reduce((acc, r) => {
      Object.entries(r.traffic_sources ?? {}).forEach(([src, count]) => {
        acc[src] = (acc[src] ?? 0) + (count as number)
      })
      return acc
    }, {} as Record<string, number>),
  }

  const kickoff = new Date(KICKOFF_DATE)
  const nowDate = today ? new Date(today.date) : new Date()
  const dayNumber = Math.max(1, Math.floor((nowDate.getTime() - kickoff.getTime()) / (1000 * 60 * 60 * 24)) + 1)

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F] p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          Synthesis Experiment
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          90-day auto-run experiment — {KICKOFF_DATE} to {END_DATE}
        </p>
      </div>

      <CampaignClient
        allRows={rows}
        baseline={baseline}
        today={today}
        dayNumber={dayNumber}
        kickoffDate={KICKOFF_DATE}
        endDate={END_DATE}
      />
    </div>
  )
}
