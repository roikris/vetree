import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

/**
 * Number of publicly visible articles — the same eligibility every public surface uses
 * (needs_enrichment = false, summary and bottom line present, not quarantined). Cached 1 h.
 * The single source for article counts shown on the site (landing page, metadata), replacing
 * hardcoded figures that had drifted to "23,000+" and "15,000+" (2026-09-28: 20,805 visible).
 */
// Throws on failure, so unstable_cache does NOT store a failure for an hour
const cachedCount = unstable_cache(
  async (): Promise<number> => {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { count, error } = await client
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('needs_enrichment', false)
      .not('summary', 'is', null)
      .not('clinical_bottom_line', 'is', null)
      .or('quarantined.is.null,quarantined.eq.false')
      // Root-layout metadata awaits this on every route when the cache is cold: bound it
      .abortSignal(AbortSignal.timeout(3000))
    if (error || count == null) throw new Error(`visible article count failed: ${error?.message ?? 'null'}`)
    return count
  },
  ['visible-article-count'],
  { revalidate: 3600 }
)

/** null when the count is unavailable (callers then omit or soften the figure) — never throws */
export async function getVisibleArticleCount(): Promise<number | null> {
  try {
    return await cachedCount()
  } catch (e) {
    console.error('[publicStats]', e)
    return null
  }
}

/** "20,000+" — rounded DOWN to the nearest thousand so the claim is always true. */
export function formatArticleCount(count: number | null): string | null {
  if (count == null || count <= 0) return null
  if (count < 1000) return String(count)
  return `${(Math.floor(count / 1000) * 1000).toLocaleString('en-US')}+`
}

/**
 * Visible articles that arrived on Vetree in the last 7 days — the feed header's "N new this week".
 * "New" = new-to-Vetree (created_at, CLAUDE.md Content Ranking Clock), not publication_date: counting
 * publication_date >= 7 days ago also counted every future-dated preprint, week after week, and
 * skipped the summary / quarantine checks. Cached 1 h, so the 7-day window moves hourly.
 */
const cachedNewThisWeek = unstable_cache(
  async (): Promise<number> => {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count, error } = await client
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('needs_enrichment', false)
      .not('summary', 'is', null)
      .not('clinical_bottom_line', 'is', null)
      .or('quarantined.is.null,quarantined.eq.false')
      .gte('created_at', since)
      .abortSignal(AbortSignal.timeout(3000))
    if (error || count == null) throw new Error(`new-this-week count failed: ${error?.message ?? 'null'}`)
    return count
  },
  ['new-this-week-count'],
  { revalidate: 3600 }
)

/** null when unavailable (the header then omits it) — never throws */
export async function getNewThisWeekCount(): Promise<number | null> {
  try {
    return await cachedNewThisWeek()
  } catch (e) {
    console.error('[publicStats]', e)
    return null
  }
}
