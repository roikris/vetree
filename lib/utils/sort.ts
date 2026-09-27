import { SortOption } from '@/types/search'

/**
 * The default order depends on context, like the species scope (lib/utils/species.ts):
 * a search opens in Best match (relevance) — the owner's decision of 2026-09-27, with a visible
 * Best match | Newest toggle on the results — while the browsing feed stays newest-first.
 * Parser and URL builder both use this, so plain `/?search=` links open in Best match and an
 * explicit choice (sort=newest) round-trips.
 */
export function defaultSortFor(search: string | null | undefined): SortOption {
  return search && search.trim() ? 'relevance' : 'newest'
}
