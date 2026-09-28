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
