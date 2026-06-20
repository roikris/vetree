'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend
} from 'recharts'

const GREEN = '#3D7A5F'
const GRAY = '#71717a'
const AMBER = '#f59e0b'
const RED = '#ef4444'

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

type Baseline = {
  median_session: number
  registered_mau: number
  dau_mau_ratio: number
  total_searches: number
  synthesis_runs: number
  synthesis_engaged: number
  traffic_sources: Record<string, number>
}

type CampaignClientProps = {
  allRows: SnapshotRow[]
  baseline: Baseline
  today: SnapshotRow | null
  dayNumber: number
  kickoffDate: string
  endDate: string
}

function pctChange(current: number, baseline: number): number | null {
  if (baseline === 0) return null
  return ((current - baseline) / baseline) * 100
}

function verdictColor(pct: number | null): string {
  if (pct === null) return AMBER
  if (pct >= 15) return GREEN
  if (pct < -5) return RED
  return AMBER
}

function verdictLabel(pct: number | null): string {
  if (pct === null) return 'New metric'
  if (pct >= 15) return `+${pct.toFixed(1)}%`
  if (pct < -5) return `${pct.toFixed(1)}%`
  return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`
}

function KpiCard({
  label,
  baselineVal,
  currentVal,
  formatter,
  isNewMetric,
}: {
  label: string
  baselineVal: number
  currentVal: number | null
  formatter: (v: number) => string
  isNewMetric?: boolean
}) {
  const pct = isNewMetric ? null : (currentVal != null ? pctChange(currentVal, baselineVal) : null)
  const color = verdictColor(pct)
  const hasData = currentVal != null

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5">Baseline</p>
          <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">{formatter(baselineVal)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5">Today</p>
          <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
            {hasData ? formatter(currentVal!) : '—'}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
        <span
          className="text-sm font-semibold"
          style={{ color }}
        >
          {isNewMetric
            ? (hasData ? `${formatter(currentVal!)} / day` : 'No data yet')
            : (hasData ? verdictLabel(pct) : '—')}
        </span>
        {!isNewMetric && hasData && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-1">vs baseline</span>
        )}
        {isNewMetric && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-1">new metric</span>
        )}
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function fmtSec(v: number) {
  if (v < 60) return `${Math.round(v)}s`
  return `${Math.floor(v / 60)}m ${Math.round(v % 60)}s`
}

function fmtNum(v: number) {
  return Math.round(v).toString()
}

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`
}

export function CampaignClient({
  allRows,
  baseline,
  today,
  dayNumber,
  kickoffDate,
  endDate,
}: CampaignClientProps) {
  const totalDays = 90
  const progressPct = Math.min(100, (dayNumber / totalDays) * 100)

  // KPI values from today's snapshot
  const todayMedianSession = today?.median_session_duration_seconds ?? null
  const todaySynthesisEngaged = today?.synthesis_engaged ?? null
  const todayRegisteredMau = today?.registered_mau ?? null
  const todayDau = today?.dau ?? null
  const todayMau = today?.mau ?? null
  const todayDauMauRatio = (todayDau != null && todayMau != null && todayMau > 0)
    ? (todayDau / todayMau) * 100
    : null

  // Chart data — add derived fields
  const chartData = allRows.map(r => ({
    date: r.date.slice(5), // MM-DD
    fullDate: r.date,
    avg_session: r.avg_session_duration_seconds ?? 0,
    median_session: r.median_session_duration_seconds ?? 0,
    synthesis_runs: r.synthesis_runs ?? 0,
    synthesis_engaged: r.synthesis_engaged ?? 0,
    dau_mau_ratio: r.mau > 0 ? parseFloat(((r.dau / r.mau) * 100).toFixed(2)) : 0,
    total_searches: r.total_searches ?? 0,
    registered_mau: r.registered_mau ?? 0,
  }))

  // Traffic sources comparison
  const recentSources = today?.traffic_sources ?? {}
  const baselineSources = baseline.traffic_sources
  const allSourceKeys = Array.from(
    new Set([...Object.keys(recentSources), ...Object.keys(baselineSources)])
  ).sort((a, b) => (recentSources[b] ?? 0) - (recentSources[a] ?? 0))

  return (
    <div className="space-y-8">
      {/* Progress bar */}
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-2xl font-bold text-[#1A1A1A] dark:text-[#E8E8E8]">Day {dayNumber}</span>
            <span className="text-zinc-500 dark:text-zinc-400 ml-2">of {totalDays}</span>
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {kickoffDate} → {endDate}
          </div>
        </div>
        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-3 mb-3">
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, backgroundColor: GREEN }}
          />
        </div>
        <div className="flex gap-6 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <span style={{ color: AMBER }}>▲</span> Day 30 — Jul 20
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: AMBER }}>▲</span> Day 60 — Aug 19
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: GREEN }}>▲</span> Day 90 — Sep 18
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Median Session"
          baselineVal={baseline.median_session}
          currentVal={todayMedianSession}
          formatter={fmtSec}
        />
        <KpiCard
          label="Synthesis Engaged"
          baselineVal={0}
          currentVal={todaySynthesisEngaged}
          formatter={fmtNum}
          isNewMetric
        />
        <KpiCard
          label="Registered MAU"
          baselineVal={baseline.registered_mau}
          currentVal={todayRegisteredMau}
          formatter={fmtNum}
        />
        <KpiCard
          label="DAU/MAU Stickiness"
          baselineVal={baseline.dau_mau_ratio}
          currentVal={todayDauMauRatio}
          formatter={fmtPct}
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session Depth */}
        <ChartCard title="Session Depth">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}s`} />
              <Tooltip formatter={(v) => fmtSec(Number(v))} />
              <Legend />
              <ReferenceLine x={kickoffDate.slice(5)} stroke={GREEN} strokeDasharray="4 4" label={{ value: 'Kickoff', fontSize: 10, fill: GREEN }} />
              <Line type="monotone" dataKey="avg_session" name="Avg" stroke={GRAY} dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="median_session" name="Median" stroke={GREEN} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Synthesis Engagement */}
        <ChartCard title="Synthesis Engagement">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <ReferenceLine x={kickoffDate.slice(5)} stroke={GREEN} strokeDasharray="4 4" label={{ value: 'Kickoff', fontSize: 10, fill: GREEN }} />
              <Line type="monotone" dataKey="synthesis_runs" name="Runs (exposed)" stroke={GRAY} dot={false} strokeWidth={1.5} strokeDasharray="4 4" />
              <Line type="monotone" dataKey="synthesis_engaged" name="Engaged (read)" stroke={GREEN} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Retention */}
        <ChartCard title="DAU/MAU Retention">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <ReferenceLine x={kickoffDate.slice(5)} stroke={GREEN} strokeDasharray="4 4" label={{ value: 'Kickoff', fontSize: 10, fill: GREEN }} />
              <ReferenceLine y={10} stroke={AMBER} strokeDasharray="3 3" label={{ value: '10% target', fontSize: 10, fill: AMBER }} />
              <Line type="monotone" dataKey="dau_mau_ratio" name="DAU/MAU %" stroke={GREEN} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Search Volume */}
        <ChartCard title="Search Volume">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <ReferenceLine x={kickoffDate.slice(5)} stroke={GREEN} strokeDasharray="4 4" label={{ value: 'Kickoff', fontSize: 10, fill: GREEN }} />
              <Line type="monotone" dataKey="total_searches" name="Searches" stroke={GREEN} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Registered User Growth */}
        <ChartCard title="Registered User Growth (MAU)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <ReferenceLine x={kickoffDate.slice(5)} stroke={GREEN} strokeDasharray="4 4" label={{ value: 'Kickoff', fontSize: 10, fill: GREEN }} />
              <Line type="monotone" dataKey="registered_mau" name="Registered MAU" stroke={GREEN} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Traffic Sources */}
        <ChartCard title="Traffic Source Quality (30d snapshot)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium text-right">Recent</th>
                  <th className="pb-2 font-medium text-right">Baseline total</th>
                  <th className="pb-2 font-medium text-right">Trend</th>
                </tr>
              </thead>
              <tbody>
                {allSourceKeys.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                      No traffic source data yet
                    </td>
                  </tr>
                )}
                {allSourceKeys.map(src => {
                  const recent = recentSources[src] ?? 0
                  const base = baselineSources[src] ?? 0
                  const trend = base > 0 ? pctChange(recent, base / Math.max(1, Object.keys(baselineSources).length)) : null
                  return (
                    <tr key={src} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                      <td className="py-2 font-medium text-zinc-700 dark:text-zinc-300 capitalize">{src}</td>
                      <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">{recent}</td>
                      <td className="py-2 text-right text-zinc-500 dark:text-zinc-500">{base}</td>
                      <td className="py-2 text-right font-medium" style={{ color: trend == null ? GRAY : trend >= 0 ? GREEN : RED }}>
                        {trend == null ? '—' : trend >= 0 ? `+${trend.toFixed(0)}%` : `${trend.toFixed(0)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">
              Session quality per source not available from current data schema.
            </p>
          </div>
        </ChartCard>
      </div>

      {/* Experiment Verdict */}
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Experiment Verdict</h3>
        {!today ? (
          <p className="text-zinc-400 dark:text-zinc-500 text-sm">No experiment data yet — check back after Day 1 aggregate runs.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Session Depth',
                pct: pctChange(todayMedianSession ?? 0, baseline.median_session),
                isNew: false,
              },
              {
                label: 'Synthesis Engaged',
                pct: null,
                isNew: true,
                note: todaySynthesisEngaged != null ? `${todaySynthesisEngaged}/day today` : 'No data',
              },
              {
                label: 'Registered MAU',
                pct: pctChange(todayRegisteredMau ?? 0, baseline.registered_mau),
                isNew: false,
              },
              {
                label: 'DAU/MAU',
                pct: pctChange(todayDauMauRatio ?? 0, baseline.dau_mau_ratio),
                isNew: false,
              },
            ].map(({ label, pct, isNew, note }) => {
              const color = verdictColor(pct)
              return (
                <div key={label} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div>
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {isNew ? (note ?? 'New metric') : verdictLabel(pct)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4">
          Green = &ge;15% improvement vs baseline &nbsp;&middot;&nbsp;
          Yellow = &minus;5% to +15% &nbsp;&middot;&nbsp;
          Red = &gt;5% decline
        </p>
      </div>
    </div>
  )
}
