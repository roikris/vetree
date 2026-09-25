import { MetadataRoute } from 'next'
import { getShardArticles, getShardCount } from '@/lib/sitemap'

// Regenerate at most daily; see lib/sitemap.ts for why this is sharded.
export const revalidate = 86400

export async function generateSitemaps() {
  // One spare shard beyond what the index lists. It renders as an empty <urlset> (200) and
  // fills on its daily regeneration, so when growth crosses a shard boundary the index's new
  // entry is already a live file — without it, a request for the not-yet-valid id caches a
  // 404 for a day.
  const n = await getShardCount()
  return Array.from({ length: n + 1 }, (_, id) => ({ id }))
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  // Next's generated handler re-runs generateSitemaps() whenever it renders (initial request
  // or ISR regeneration; cache hits skip it) and 404s ids it doesn't return.
  const shard = Number(await props.id)
  if (!Number.isInteger(shard) || shard < 0) return []

  const now = Date.now()
  return (await getShardArticles(shard)).map((article) => {
    // When the page last changed, not the paper's publication_date (which can be months
    // in the future for preprints). Never emit a future date.
    const stamp = article.updated_at || article.created_at
    const t = stamp ? new Date(stamp).getTime() : NaN
    return {
      url: `https://vetree.app/article/${article.id}`,
      ...(Number.isFinite(t) ? { lastModified: new Date(Math.min(t, now)) } : {}),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }
  })
}
