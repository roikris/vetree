// The landing page's "Try —" suggestion chips (components/home/LandingPage.tsx). Their links carry `via=chip` so a
// search that started from a chip is logged as such (search_logs.via, migration 092, analytics-003): nobody typed it,
// and crawlers that follow links log one on nearly every visit (Sep–Nov 2026: 44 of 78 recorded searches).
export const SEARCH_CHIPS = ['canine diabetes management', 'feline hypertension', 'TPLO outcomes', 'lymphoma chemotherapy'] as const

/** UTC date the filtered search figures start (the 092 deploy) — before it, every search reader counted every row. */
export const SEARCH_DEMAND_SINCE = '2026-11-26'

export function chipHref(chip: string): string {
  return `/?search=${encodeURIComponent(chip)}&via=chip`
}

/**
 * The `via` to log with a search: 'chip' only when the page URL says via=chip, its search param is the very query
 * being logged, and that query is a current chip. Anything else (a typed search, a changed query) → undefined.
 */
export function searchVia(locationSearch: string, loggedQuery: string, chips: readonly string[] = SEARCH_CHIPS): 'chip' | undefined {
  const p = new URLSearchParams(locationSearch)
  if (p.get('via') !== 'chip') return undefined
  const q = (p.get('search') || '').trim()
  return q && q === loggedQuery.trim() && chips.includes(q) ? 'chip' : undefined
}
