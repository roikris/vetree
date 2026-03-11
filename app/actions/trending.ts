'use server'

import { createClient } from '@/lib/supabase/server'

export async function getTrendingArticles() {
  const supabase = await createClient()

  // Get most saved articles in last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: trendingData, error: trendingError } = await supabase
    .from('saved_articles')
    .select('article_id')
    .gte('saved_at', sevenDaysAgo.toISOString())

  if (trendingError) {
    console.error('Error fetching trending articles:', trendingError)
    return { articles: [], error: trendingError.message }
  }

  // Count saves per article
  const saveCounts: Record<string, number> = {}
  trendingData?.forEach((item) => {
    saveCounts[item.article_id] = (saveCounts[item.article_id] || 0) + 1
  })

  // Get top 5 article IDs
  const topArticleIds = Object.entries(saveCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id)

  // Return empty if fewer than 3 trending articles
  if (topArticleIds.length < 3) {
    return { articles: [], error: null }
  }

  // Fetch full article data for trending articles (only enriched)
  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('*')
    .in('id', topArticleIds)
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')

  if (articlesError) {
    console.error('Error fetching article details:', articlesError)
    return { articles: [], error: articlesError.message }
  }

  // Sort articles by save count and add save count to each
  const articlesWithSaveCount = articles?.map((article) => ({
    ...article,
    save_count: saveCounts[article.id] || 0,
  }))
  .sort((a, b) => b.save_count - a.save_count) || []

  return { articles: articlesWithSaveCount, error: null }
}
