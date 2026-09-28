/**
 * The synthesis auto-run experiment window (run 2). Shared by the admin campaign dashboard and the
 * synthesis panel, which must not let a run recorded before kickoff count as a run-2 engagement.
 * Run 1 (2026-06-20 → 2026-09-28) is not comparable: CI smoke traffic was counted as runs and the
 * synthesis cache never stored (migration 063).
 */
export const EXPERIMENT_KICKOFF_DATE = '2026-09-29'
export const EXPERIMENT_END_DATE = '2026-12-27'  // day 90, inclusive

/** True when an ISO timestamp falls inside [kickoff 00:00 UTC, end + 1 day 00:00 UTC) */
export function inExperimentWindow(iso: string | null | undefined): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  const from = Date.parse(`${EXPERIMENT_KICKOFF_DATE}T00:00:00Z`)
  const to = Date.parse(`${EXPERIMENT_END_DATE}T00:00:00Z`) + 24 * 3600 * 1000
  return t >= from && t < to
}
