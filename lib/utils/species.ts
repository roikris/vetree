import { QuickFilter } from '@/types/search'

/**
 * Species scoping for the article feed and search.
 *
 * Vetree's audience is small-animal first, but large-animal research is kept
 * reachable rather than excluded — there are ~7,800 large-animal-only articles
 * already enriched and they used to be invisible to search while still being
 * visible in browse.
 *
 * The default view is defined by EXCLUSION, not by requiring a label. Requiring
 * 'Small Animal' would silently hide the ~2,800 enriched articles that carry no
 * species label at all, which is an enrichment gap, not an editorial decision.
 *
 * DEFAULT_QUICK_FILTER ('small-animal') therefore means "everything except
 * large-animal-only". Articles tagged BOTH small and large animal (zoonoses,
 * cross-species drugs; ~1,700) stay in the default view.
 */
export const LARGE_ANIMAL_LABELS = [
  'Equine', 'equine',
  'Large Animal', 'large animal',
  'Livestock', 'livestock',
  'Poultry', 'poultry',
  'Food Animal', 'food animal',
] as const

export const SMALL_ANIMAL_LABELS = ['Small Animal', 'small animal'] as const

/** Default scope of the browsing feed (no search). */
export const DEFAULT_QUICK_FILTER: QuickFilter = 'small-animal'

/**
 * The default scope depends on context. A search starts UNFILTERED — all species — and
 * the reader narrows the results with the filter bar; the browsing feed keeps the
 * small-animal default (owner decision, 2026-09-26). This makes every search entry point
 * (search box, landing/example chips, sitelinks search box, synthesis and admin links,
 * all of which build plain `/?search=` URLs) behave the same, and means a search's logged
 * result count is its unfiltered count — so a zero-result log is a genuine content gap
 * rather than "nothing in the small-animal scope".
 */
export function defaultQuickFilterFor(search: string | null | undefined): QuickFilter {
  return search && search.trim() ? 'all' : DEFAULT_QUICK_FILTER
}

function hasAny(labels: string[] | null | undefined, set: readonly string[]): boolean {
  return !!labels?.some(l => set.includes(l))
}

/** True when an article is large-animal and NOT also small-animal. */
export function isLargeAnimalOnly(labels: string[] | null | undefined): boolean {
  return hasAny(labels, LARGE_ANIMAL_LABELS) && !hasAny(labels, SMALL_ANIMAL_LABELS)
}

/** JS-side predicate — used on RPC results, which are filtered in memory. */
export function matchesQuickFilter(
  labels: string[] | null | undefined,
  quickFilter: QuickFilter,
): boolean {
  if (quickFilter === 'all') return true
  if (quickFilter === 'large-animal') return hasAny(labels, LARGE_ANIMAL_LABELS)
  return !isLargeAnimalOnly(labels)
}

/**
 * PostgREST array literal. Quoted because several labels contain a space.
 * Verified against a deterministic full scan: ov(LARGE) = 9,518 and
 * or(not.ov(LARGE), ov(SMALL)) = 17,500 both match the in-memory computation
 * exactly, so this filter is safe to run in SQL and pagination/counts stay correct.
 */
function pgArray(labels: readonly string[]): string {
  return `{${labels.map(l => (l.includes(' ') ? `"${l}"` : l)).join(',')}}`
}

/** Applies species scoping to a Supabase query builder (browse path). */
export function applyQuickFilter<T>(query: T, quickFilter: QuickFilter): T {
  const q = query as any
  if (quickFilter === 'all') return q
  if (quickFilter === 'large-animal') {
    return q.overlaps('labels', LARGE_ANIMAL_LABELS as unknown as string[])
  }
  // Default: not large-animal-only — i.e. no large-animal label, OR also small-animal.
  // `labels.is.null` is required for parity with matchesQuickFilter(): in SQL both overlap
  // tests evaluate to NULL for a NULL array, so without it the row is dropped here while the
  // JS predicate (used on RPC results) keeps it.
  return q.or(
    `labels.is.null,labels.not.ov.${pgArray(LARGE_ANIMAL_LABELS)},labels.ov.${pgArray(SMALL_ANIMAL_LABELS)}`,
  )
}
