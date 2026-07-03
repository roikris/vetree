import { createClient } from '@supabase/supabase-js'
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Fetch all public article IDs and dates
  const { data: articles } = await supabase
    .from('articles')
    .select('id, publication_date, updated_at')
    .eq('needs_enrichment', false)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')
    .order('publication_date', { ascending: false })

  const articleUrls = (articles || []).map((article) => ({
    url: `https://vetree.app/article/${article.id}`,
    lastModified: new Date(article.updated_at || article.publication_date),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [
    {
      url: 'https://vetree.app',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: 'https://vetree.app/privacy',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://vetree.app/terms',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...articleUrls,
  ]
}
