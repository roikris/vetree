/**
 * The synthesis auto-run experiment window (run 2). Shared by the admin campaign dashboard and the
 * synthesis panel, which must not let a run recorded before kickoff count as a run-2 engagement.
 * Run 1 (2026-06-20 → 2026-09-28) is not comparable: CI smoke traffic was counted as runs and the
 * synthesis cache never stored (migration 063).
 */
export const EXPERIMENT_KICKOFF_DATE = '2026-09-29'
export const EXPERIMENT_END_DATE = '2026-12-27'  // day 90, inclusive
export const EXPERIMENT_TOTAL_DAYS = 90
// Baseline: the pre-experiment month (no auto-run; synthesis was a manual button)
export const EXPERIMENT_BASELINE_START = '2026-05-21'
export const EXPERIMENT_BASELINE_END = '2026-06-19'
// Copied in .github/workflows/scripts/growth-daily-reminder.js (plain Node, can't import this);
// tests/unit/experiment.test.ts keeps the two in step.

const DAY_MS = 24 * 3600 * 1000

/** The experiment day (1–90) of a YYYY-MM-DD date (UTC), clamped — the Campaign page's counter */
export function experimentDayNumber(date: string): number {
  const days = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${EXPERIMENT_KICKOFF_DATE}T00:00:00Z`)) / DAY_MS)
  return Math.min(EXPERIMENT_TOTAL_DAYS, Math.max(1, days + 1))
}

/** Where the experiment stands at an instant: ended from END_DATE + 1 day 00:00 UTC */
export function experimentPhase(now: Date): 'before' | 'running' | 'ended' {
  const t = now.getTime()
  if (t < Date.parse(`${EXPERIMENT_KICKOFF_DATE}T00:00:00Z`)) return 'before'
  if (t >= Date.parse(`${EXPERIMENT_END_DATE}T00:00:00Z`) + DAY_MS) return 'ended'
  return 'running'
}

/** True when an ISO timestamp falls inside [kickoff 00:00 UTC, end + 1 day 00:00 UTC) */
export function inExperimentWindow(iso: string | null | undefined): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  const from = Date.parse(`${EXPERIMENT_KICKOFF_DATE}T00:00:00Z`)
  const to = Date.parse(`${EXPERIMENT_END_DATE}T00:00:00Z`) + 24 * 3600 * 1000
  return t >= from && t < to
}
