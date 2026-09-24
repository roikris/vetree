import { createClient } from '@supabase/supabase-js'

/**
 * Article sitemap data, split into shards.
 *
 * One file stopped being viable: ~25,000 articles is ~4.3 MB of XML, and Vercel caps a
 * function response at 4.5 MB. Shards of SHARD_SIZE articles (~0.9 MB) are listed by the
 * index at /sitemap.xml (app/sitemap.xml/route.ts) — the URL robots.txt and Search Console
 * already point at — and served from /sitemaps/sitemap/{n}.xml (app/sitemaps/sitemap.ts).
 *
 * Shard n is rows [n * SHARD_SIZE, (n + 1) * SHARD_SIZE) in `id` order (`id` is the unique
 * primary key, so the order is total). The 1,000-row reads are separate queries with no
 * shared snapshot, and shards regenerate independently, so an insert, delete or eligibility
 * change mid-generation can skip or repeat a boundary row until the next daily regeneration.
 * Acceptable for a discovery aid; a stable table is covered exactly (verified: 25,285 of
 * 25,285, no duplicates).
 */
export const SHARD_SIZE = 5000
const PAGE_SIZE = 1000 // PostgREST max-rows cap

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Same eligibility predicate as every public article surface (and the RLS policy, 052)
function eligible(q: any) {
  return q
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')
}

// Transient failures happen: a build prerenders the index and every shard in parallel
// workers, and one count request failed mid-build (HEAD request, so an empty error
// message). Retry a few times before giving up.
async function withRetry<T>(label: string, run: () => PromiseLike<{ data?: T; count?: number | null; error: any }>) {
  let last: any
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt))
    const res = await run()
    if (!res.error || res.error.code === 'PGRST103') return res
    last = res.error
  }
  throw new Error(`sitemap: ${label} failed after 3 attempts: ${last?.message || last?.code || JSON.stringify(last)}`)
}

// Errors throw rather than return a short list: with ISR, a failed regeneration keeps
// serving the last good file instead of replacing it with a truncated one.
export async function getShardCount(): Promise<number> {
  const { count } = await withRetry('count', () =>
    eligible(anonClient().from('articles').select('id', { count: 'exact', head: true }))
  )
  if (count == null) throw new Error('sitemap: count returned null')
  return Math.max(1, Math.ceil(count / SHARD_SIZE))
}

export async function getShardArticles(shard: number) {
  const supabase = anonClient()
  const start = shard * SHARD_SIZE
  const rows: { id: string; updated_at: string | null; created_at: string | null }[] = []
  for (let from = start; from < start + SHARD_SIZE; from += PAGE_SIZE) {
    const { data, error } = await withRetry<typeof rows>(`shard ${shard} row ${from}`, () =>
      eligible(supabase.from('articles').select('id, updated_at, created_at'))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
    )
    // PGRST103 = offset past the end: this shard has no more rows
    if (error?.code === 'PGRST103') break
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}
