// LinkedIn per-post numbers (analytics-002, Roi 2026-11-23). Pure rules, tested offline (tests/unit/linkedinPostMetrics.test.ts).
//
// A LinkedIn analytics export's "Top posts" sheet counts a post's impressions / engagements over the EXPORT'S date
// range only, and lists the top 50 posts of that range — by engagements (left) and by impressions (right), separately.
// The upload used to overwrite a row with the latest export's numbers, so an old post listed in a quiet week dropped
// from thousands to a handful (2026-06-11 post: 4 impressions stored, 9,375 on LinkedIn). Now each metric keeps the
// HIGHEST value any export reported — a lower bound of the post's lifetime number — with the range it was counted over.

export type Period = { start: string; end: string } // YYYY-MM-DD, inclusive
export type StoredMetric = { value: number | null; start: string | null; end: string | null }

/** The export's date range: the first and last day of its daily ("Engagement") sheet, or null without one. */
export function exportPeriod(dates: string[]): Period | null {
  const ds = dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  return ds.length ? { start: ds[0], end: ds[ds.length - 1] } : null
}

/**
 * One metric after an export: an incoming value higher than the stored one replaces it (with this export's range);
 * otherwise the stored value and its range stay. `changed` says whether anything is written.
 */
export function mergeMetric(stored: StoredMetric | null, incoming: number | null, period: Period | null): StoredMetric & { changed: boolean } {
  const keep = stored ?? { value: null, start: null, end: null }
  if (incoming === null) return { ...keep, changed: false }
  if (keep.value !== null && incoming <= keep.value) return { ...keep, changed: false }
  return { value: incoming, start: period?.start ?? null, end: period?.end ?? null, changed: true }
}

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)

/** Posts collect most of their impressions in the first week: a range starting later than this misses them. */
export const LAUNCH_DAYS = 7

/**
 * Why a stored number probably understates the post's lifetime total, or null when its range covers the launch week.
 * - 'unknown_range': written before migration 090 or entered by hand
 * - 'missed_launch': counted over a range that started more than LAUNCH_DAYS after the post
 */
export function undercountReason(postDate: string, m: StoredMetric): 'unknown_range' | 'missed_launch' | null {
  if (m.value === null) return null
  if (!m.start) return 'unknown_range'
  return m.start > addDays(postDate, LAUNCH_DAYS - 1) ? 'missed_launch' : null
}
