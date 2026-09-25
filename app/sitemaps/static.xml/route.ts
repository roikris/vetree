// Non-article pages, listed by the sitemap index (app/sitemap.xml/route.ts)
export const revalidate = 86400

const PAGES = [
  { loc: 'https://vetree.app', changefreq: 'daily', priority: '1.0' },
  { loc: 'https://vetree.app/privacy', changefreq: 'yearly', priority: '0.3' },
  { loc: 'https://vetree.app/terms', changefreq: 'yearly', priority: '0.3' },
]

export async function GET() {
  const now = new Date().toISOString()
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    PAGES.map(
      (p) => `<url><loc>${p.loc}</loc><lastmod>${now}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
    ).join('\n') +
    '\n</urlset>\n'
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
}
