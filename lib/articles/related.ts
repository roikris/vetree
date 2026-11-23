// "Keep reading" on article pages (seo-002, Roi 2026-11-23). Pure rules, tested offline (tests/unit/related.test.ts).
// Why: of 710 signed-out Google landings on article pages (2026-10-14 → 11-23, likely-automated left out) only 2%
// opened a second page. The old list was the 2 newest articles sharing ANY label — with "Internal Medicine" or
// "Small Animal" on most articles that was close to "the 2 newest articles", in a side rail that phones show last.

/** Labels on a large share of articles: a match on one of these alone says little about the topic. */
export const BROAD_LABELS = new Set(['Small Animal', 'Internal Medicine', 'Pathology', 'Pharmacology'])

export const LARGE_ANIMAL = ['Equine', 'equine', 'Large Animal', 'large animal', 'Livestock', 'livestock', 'Poultry', 'poultry', 'Food Animal', 'food animal']

/** The labels to look candidates up by: the specific ones when the article has any, else all of them. */
export function lookupLabels(labels: string[] | null | undefined): string[] {
  const all = (labels ?? []).filter(l => !LARGE_ANIMAL.includes(l))
  const specific = all.filter(l => !BROAD_LABELS.has(l))
  return specific.length ? specific : all
}

/** Shared specific label = 3, shared broad label = 1. */
export function relatedScore(labels: string[], candidate: string[] | null | undefined): number {
  const mine = new Set(labels)
  return (candidate ?? []).reduce((s, l) => s + (mine.has(l) ? (BROAD_LABELS.has(l) ? 1 : 3) : 0), 0)
}

/**
 * The n best candidates: large-animal articles dropped (rule 4 — JS, not Supabase), highest score first; equal scores
 * keep the query's order (newest first). Candidates sharing nothing are dropped.
 */
export function rankRelated<T extends { id: string; labels: string[] | null }>(
  labels: string[] | null | undefined, currentId: string, candidates: T[], n: number,
): T[] {
  const mine = labels ?? []
  return candidates
    .filter(c => c.id !== currentId && !c.labels?.some(l => LARGE_ANIMAL.includes(l)))
    .map((c, i) => ({ c, i, s: relatedScore(mine, c.labels) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n)
    .map(x => x.c)
}
