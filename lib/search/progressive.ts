import { supabase } from '@/lib/supabase'
import { ParsedFilters } from '@/types/search'
import { normalizeQuery } from '@/lib/utils/normalizeQuery'
import { sanitizeSearchTerm, fallbackSearch, FALLBACK_CAP } from '@/lib/queries/articles'

/**
 * Progressive search (plan reviewed with Codex over 6 rounds; migration 060).
 *
 * One shared path for the server-rendered first batch (components/search/SearchResults) and
 * every later batch (GET /api/search/batch), so both parse, normalize and page identically.
 *
 * - Best match (sort=relevance, the default for searches): the newest BATCH_SIZE in-scope
 *   matches, ordered by relevance. One batch; exact when there are fewer matches than that.
 * - Newest / oldest: date-ordered batches of BATCH_SIZE, continued with a keyset cursor.
 * - Zero full-text matches: capped closest-match fallback (typos, author names).
 */

export const BATCH_SIZE = 500

export type SearchArticle = {
  id: string
  title: string
  clinical_bottom_line: string
  labels: string[]
  source_journal: string
  publication_date: string
  authors: string
  pubmed_id: string
  doi: string
  article_url: string
  strength_of_evidence: string
}

export type Disclosure =
  | { kind: 'complete' }
  /** Best match whose pool was full: best among the BATCH_SIZE most recent matches */
  | { kind: 'best-of-recent'; poolSize: number }
  /** No full-text matches; closest matches instead */
  | { kind: 'fallback'; cap: number; capped: boolean; tier: 'exact' | 'ilike' | 'fuzzy' | null }

export type BatchResult =
  | { ok: true; articles: SearchArticle[]; nextCursor: string | null; done: boolean; disclosure: Disclosure }
  | { ok: false; status: 400 | 500; error: string }

type Cursor = { v: 1; s: 'newest' | 'oldest'; d: string; i: string }

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url')
}

/** null for a malformed cursor (→ 400). Validates shape, a real calendar date, and the sort. */
export function decodeCursor(raw: string, sort: string): Cursor | null {
  try {
    if (raw.length > 400) return null
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (!c || c.v !== 1 || (c.s !== 'newest' && c.s !== 'oldest') || c.s !== sort) return null
    if (typeof c.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.d)) return null
    const dt = new Date(`${c.d}T00:00:00Z`)
    if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== c.d) return null
    if (typeof c.i !== 'string' || c.i.length === 0 || c.i.length > 100) return null
    return c as Cursor
  } catch {
    return null
  }
}

/** Query text as the database receives it; null when nothing searchable remains. */
export function searchTextFor(filters: ParsedFilters): string | null {
  const corrected = filters.search ? normalizeQuery(filters.search) : ''
  const sanitized = corrected ? sanitizeSearchTerm(corrected) : ''
  return sanitized ? sanitized.slice(0, 200) : null
}

const CARD_FIELDS = (r: any): SearchArticle => ({
  id: r.id, title: r.title, clinical_bottom_line: r.clinical_bottom_line, labels: r.labels,
  source_journal: r.source_journal, publication_date: r.publication_date, authors: r.authors,
  pubmed_id: r.pubmed_id, doi: r.doi, article_url: r.article_url,
  strength_of_evidence: r.strength_of_evidence,
})

export async function runSearchBatch(filters: ParsedFilters, cursor: Cursor | null): Promise<BatchResult> {
  const text = searchTextFor(filters)
  if (!text) {
    return { ok: true, articles: [], nextCursor: null, done: true, disclosure: { kind: 'complete' } }
  }
  if (cursor && filters.sort === 'relevance') {
    return { ok: false, status: 400, error: 'Best match has a single batch' }
  }

  const call = () => supabase.rpc('search_articles_batch', {
    search_query: text,
    species_scope: filters.quickFilter,
    filter_labels: filters.labels.length > 0 ? filters.labels : null,
    labels_match_all: filters.labelOperator === 'AND',
    filter_evidence: filters.evidence.length > 0 ? filters.evidence : null,
    filter_journals: filters.journals.length > 0 ? filters.journals : null,
    sort_order: filters.sort,
    cursor_date: cursor?.d ?? null,
    cursor_id: cursor?.i ?? null,
    batch_size: BATCH_SIZE,
  })

  let { data, error } = await call()
  // A cold, very broad search can exceed anon's 3 s statement_timeout once (measured: a cold
  // "dog" Best match); the first attempt warms the cache, and the retry measured 2.3 s. One
  // retry, only for a timeout — the sprout loader covers the wait. Anon role kept on purpose
  // (the service key would lift the limit to 8 s but is reserved for admin paths).
  if (error?.code === '57014') {
    console.warn('[search] batch timed out, retrying once:', text)
    ;({ data, error } = await call())
  }

  if (error) {
    // 22023 = invalid input, raised by the function's own validation
    if (error.code === '22023') return { ok: false, status: 400, error: 'Invalid search parameters' }
    console.error('[search] batch RPC failed:', error.code, error.message)
    return { ok: false, status: 500, error: 'Search is temporarily unavailable. Please try again.' }
  }

  const rows = data ?? []

  // Nothing matched the full-text search: closest matches instead (first batch only, and
  // only after a SUCCESSFUL empty batch — an RPC error returned above).
  if (rows.length === 0 && !cursor) {
    try {
      const fb = await fallbackSearch(filters, text)
      return {
        ok: true,
        articles: fb.data.map(CARD_FIELDS),
        nextCursor: null,
        done: true,
        disclosure: fb.data.length > 0
          ? { kind: 'fallback', cap: FALLBACK_CAP, capped: fb.capped, tier: fb.tier }
          : { kind: 'complete' },
      }
    } catch (e) {
      console.error('[search] fallback failed:', e)
      return { ok: false, status: 500, error: 'Search is temporarily unavailable. Please try again.' }
    }
  }

  if (filters.sort === 'relevance') {
    return {
      ok: true,
      articles: rows.map(CARD_FIELDS),
      nextCursor: null,
      done: true,
      disclosure: rows.length >= BATCH_SIZE ? { kind: 'best-of-recent', poolSize: BATCH_SIZE } : { kind: 'complete' },
    }
  }

  // newest / oldest: rows come back in date order, so the last row is the keyset position.
  // Exhaustion is decided from the raw database rows.
  const done = rows.length < BATCH_SIZE
  const last = rows[rows.length - 1]
  const nextCursor = done || !last
    ? null
    : encodeCursor({ v: 1, s: filters.sort as 'newest' | 'oldest', d: String(last.sort_key), i: last.id })
  return { ok: true, articles: rows.map(CARD_FIELDS), nextCursor, done, disclosure: { kind: 'complete' } }
}

/** Stable identity of a search, for the Suspense key and the client list's reset. */
export function searchKeyFor(filters: ParsedFilters): string {
  return JSON.stringify([
    filters.search.trim(), filters.quickFilter, [...filters.labels].sort(), filters.labelOperator,
    [...filters.evidence].sort(), [...filters.journals].sort(), filters.sort, filters.view,
  ])
}
