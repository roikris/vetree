import { excludedUsersOrFilter } from '@/lib/analytics-excluded-ids'
import { LIKELY_HUMAN_OR } from '@/lib/analytics/readAll'
import { SEARCH_DEMAND_SINCE } from '@/lib/search/chips'

// Search demand (analytics-003, Roi 2026-11-25): what readers count as "people searched for X". Left out:
// - admin + test account (rule 10)
// - confirmed crawlers (bot_name) — always, as every page_views reader does
// - suggestion-chip searches (via = 'chip') — always, in both modes: nobody typed them, so they are not demand
// - the likely-automated estimate from signed-out visitors (traffic_class), unless includeAutomated
// Several .or() filters on one query are ANDed.
export function searchDemand<Q extends { or(f: string): unknown; is(c: string, v: null): unknown }>(q: Q, includeAutomated = false): Q {
  let out = (q.or(excludedUsersOrFilter()) as Q)
  out = (out.is('bot_name', null) as Q)
  out = (out.is('via', null) as Q)
  return includeAutomated ? out : (out.or(LIKELY_HUMAN_OR) as Q)
}

/** For the insights prompt: search figures changed meaning at the cutover. */
export const SEARCH_CUTOVER_NOTE = `Search figures exclude crawlers, suggestion-chip searches and signed-out likely-automated searches from ${SEARCH_DEMAND_SINCE}; earlier snapshots, signals and insights counted them (most of the earlier "searches" were crawlers clicking the landing page's chips). Don't treat a drop in searches across that date as a trend, and confirm any pre-${SEARCH_DEMAND_SINCE} search-based signal or past recommendation against the current filtered demand before reusing it.`

/** The logger's "search logging may be broken" signal: zero RECORDED rows of any kind (bots and chips included). */
export function searchLoggingGap(recordedRows: number): boolean {
  return recordedRows === 0
}
