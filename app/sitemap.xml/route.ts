import { getShardCount } from '@/lib/sitemap'

// Sitemap index at the URL robots.txt and Search Console already use. Lists the static
// pages' sitemap and every article shard (lib/sitemap.ts).
export const revalidate = 86400

export async function GET() {
  const n = await getShardCount()
  const now = new Date().toISOString()
  const locs = [
    'https://vetree.app/sitemaps/static.xml',
    ...Array.from({ length: n }, (_, i) => `https://vetree.app/sitemaps/sitemap/${i}.xml`),
  ]
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    locs.map((loc) => `<sitemap><loc>${loc}</loc><lastmod>${now}</lastmod></sitemap>`).join('\n') +
    '\n</sitemapindex>\n'
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
}
