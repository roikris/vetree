'use client'

// Activation (Batch C #12): did new readers get value (first save), and did they come back?
// Definitions live in lib/analytics/activation.ts and CLAUDE.md → Metrics.

import { useEffect, useState } from 'react'
import { getActivationMetrics } from '@/app/actions/analytics'
import type { ActivationMetrics as Metrics } from '@/lib/analytics/activation'
import { ACTIVATION_RELIABLE_FROM } from '@/lib/analytics/activation'

const RANGES = [30, 60, 120]

function Stat({ label, n, of, sub }: { label: string; n: number; of: number; sub: string }) {
  return (
    <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
      <div className="text-sm text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mt-1">
        {of > 0 ? `${Math.round((100 * n) / of)}%` : '–'}
        <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400 ml-2">{n} of {of}</span>
      </div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{sub}</div>
    </div>
  )
}

export function ActivationMetrics() {
  const [days, setDays] = useState(60)
  // The result carries the range it was computed for: loading = no result for the selected range yet
  const [result, setResult] = useState<{ days: number; data: Metrics | null; error: string | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    getActivationMetrics(days).then(
      res => { if (!cancelled) setResult({ days, data: res.data, error: res.error }) },
      err => { if (!cancelled) setResult({ days, data: null, error: err instanceof Error ? err.message : 'Request failed' }) },
    )
    return () => { cancelled = true }
  }, [days])

  const loading = result?.days !== days
  const data = loading ? null : result.data
  const error = loading ? null : result.error

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">Activation</h2>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              aria-pressed={days === r}
              className={`px-3 py-1 text-sm rounded ${days === r ? 'bg-[#3D7A5F] text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="py-6 text-zinc-500 dark:text-zinc-400">Loading…</div>}
      {!loading && error && <div className="text-red-600 dark:text-red-400">Error: {error}</div>}
      {!loading && data && (
        <>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            New confirmed accounts that signed up {data.cohortFrom} → {data.cohortTo} (each has had a full 7 days); admin and test account excluded.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat label="First save within 7 days" n={data.firstSave} of={data.cohortSize} sub="saved ≥ 1 article (a lower bound: unsaving removes the record)" />
            <Stat label="Came back within 7 days" n={data.returned} of={data.cohortSize} sub="a page view on a later calendar day (UTC) than signup" />
            <Stat label={`Returning signed-out visitors (${days}d)`} n={data.anonReturning} of={data.anonVisitors} sub="seen on 2+ days (approximate: IPs change and are shared)" />
          </div>
          {data.cohortSize < 30 && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
              Only {data.cohortSize} accounts in this cohort — treat the percentages as directional, not as a trend.
            </p>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            Test traffic has been excluded at the source since {ACTIVATION_RELIABLE_FROM}; earlier data may include it (searches before 2026-09-27 certainly do).
          </p>
        </>
      )}
    </div>
  )
}
