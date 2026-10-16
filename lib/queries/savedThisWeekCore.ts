// "Articles saved this week" (feed-002) — the logic, free of Next and Supabase imports so tests can drive it.
// lib/queries/savedThisWeek.ts wires it to the real clients and the hourly cache.
import { isLargeAnimalOnly } from '@/lib/utils/species'

export const HOUR_MS = 60 * 60 * 1000
const WEEK_MS = 7 * 24 * HOUR_MS
const CANDIDATES = 20   // wider than the 5 shown: large-animal-only articles are dropped afterwards (rule 4)
const SHOWN = 5
const MIN_SHOWN = 3     // fewer → the section is hidden (the row needs three cards)

export type SavedThisWeekArticle = {
  id: string
  title: string
  clinical_bottom_line: string | null
  labels: string[] | null
  source_journal: string | null
  save_count: number
}

export type SaveCount = { article_id: string; save_count: number | string }
export type ArticleRow = Omit<SavedThisWeekArticle, 'save_count'>

export type SavedThisWeekDeps = {
  /** admin + test account ids; may throw (an invalid TEST_USER_ID) — the caller then hides the section */
  excludedIds: () => Promise<string[]>
  /** public.saved_this_week(): ordered by count, then newer article, then id; throws on error */
  countSaves: (args: { since: string; until: string; excluded: string[]; limit: number }) => Promise<SaveCount[]>
  /** the publicly visible articles among ids (any order); throws on error */
  fetchArticles: (ids: string[]) => Promise<ArticleRow[]>
}

/** The week before the start of `hour` (hours since the epoch, UTC): [hour − 7 d, hour). */
export function weekWindow(hour: number): { since: string; until: string } {
  const until = hour * HOUR_MS
  return { since: new Date(until - WEEK_MS).toISOString(), until: new Date(until).toISOString() }
}

/** Throws on any failure (never cache one); [] when fewer than three articles qualify. */
export async function loadSavedThisWeek(hour: number, deps: SavedThisWeekDeps): Promise<SavedThisWeekArticle[]> {
  const excluded = await deps.excludedIds()
  const counts = await deps.countSaves({ ...weekWindow(hour), excluded, limit: CANDIDATES })
  if (counts.length < MIN_SHOWN) return []

  const rows = await deps.fetchArticles(counts.map((c) => c.article_id))
  const byId = new Map(rows.map((r) => [r.id, r]))
  // The function's order is kept: ties were settled in SQL, before its LIMIT
  const articles: SavedThisWeekArticle[] = []
  for (const c of counts) {
    const row = byId.get(c.article_id)
    if (!row || isLargeAnimalOnly(row.labels)) continue
    articles.push({ ...row, save_count: Number(c.save_count) })
    if (articles.length === SHOWN) break
  }
  return articles.length < MIN_SHOWN ? [] : articles
}
