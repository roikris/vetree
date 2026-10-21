// Growth OS: rest recommendations Roi keeps seeing but never acts on (growth-003, Roi 2026-10-21).
// The ranking is fixed, so an article that is neither posted nor dismissed stayed in the panel day after day
// (one was shown 10 days running). Rule: an article shown on PASSED_OVER_DAYS different Israel days, with no
// post or dismissal, sits out for PASSED_OVER_REST_DAYS days, then may return and is counted again.
// Only days before today count, so reloading the panel during the day never changes today's list.
// Pure — no Supabase: tested in tests/unit/passedOver.test.ts.

import { israelDate, israelDateMinus } from '@/lib/growth/daily'

export const PASSED_OVER_DAYS = 3
export const PASSED_OVER_REST_DAYS = 14

/**
 * Articles resting today. `sets` = served recommendation sets (growth_recommendation_sets: served_at + item ids).
 * Articles with any growth_agent_memory outcome are handled by their own rules in candidates.ts; this only
 * decides rest from showings.
 */
export function restingPassedOver(
  sets: { served_at: string; article_ids: string[] }[],
  now: number,
): Set<string> {
  const today = israelDate(now)
  const days = new Map<string, Set<string>>()   // article → Israel days it was shown, before today
  for (const s of sets) {
    const day = israelDate(s.served_at)
    if (day >= today) continue
    for (const id of s.article_ids) {
      if (!days.has(id)) days.set(id, new Set())
      days.get(id)!.add(day)
    }
  }

  const resting = new Set<string>()
  for (const [id, set] of days) {
    let count = 0
    let restUntil: string | null = null           // last rest day, inclusive
    for (const day of [...set].sort()) {
      if (restUntil && day <= restUntil) continue  // shown while resting (e.g. before this rule existed)
      count++
      if (count === PASSED_OVER_DAYS) {
        restUntil = israelDateMinus(day, -PASSED_OVER_REST_DAYS)
        count = 0
      }
    }
    if (restUntil && today <= restUntil) resting.add(id)
  }
  return resting
}
