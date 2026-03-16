'use server'

import { createClient } from '@/lib/supabase/server'
import { BatchOperations, queryCache } from '@/lib/database'
import { revalidatePath } from 'next/cache'

export async function saveArticle(articleId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('saved_articles')
    .insert({
      user_id: user.id,
      article_id: articleId,
    })

  if (error) {
    return { error: error.message }
  }

  // Invalidate related cache entries
  queryCache.invalidate(`saved_articles:${user.id}`)
  queryCache.invalidate('trending_articles')

  revalidatePath('/library')
  return { success: true }
}

export async function unsaveArticle(articleId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('saved_articles')
    .delete()
    .eq('user_id', user.id)
    .eq('article_id', articleId)

  if (error) {
    return { error: error.message }
  }

  // Invalidate related cache entries
  queryCache.invalidate(`saved_articles:${user.id}`)
  queryCache.invalidate('trending_articles')

  revalidatePath('/library')
  return { success: true }
}

export async function getSavedArticles() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { articles: [], error: 'Not authenticated' }
  }

  // Use batch operations to optimize the query
  const batchOps = BatchOperations.getInstance()
  
  try {
    const savedArticles = await batchOps.batchGetSavedArticles([user.id], supabase)
    
    // Extract and filter articles
    const articles = savedArticles
      .filter((item: any) => item.user_id === user.id)
      .map((item: any) => ({
        ...item.articles,
        saved_at: item.saved_at
      }))
      .sort((a: any, b: any) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime())

    return { articles, error: null }
  } catch (error: any) {
    console.error('[saved-articles] Error:', error)
    return { articles: [], error: error.message }
  }
}

export async function getUserSavedArticleIds() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { articleIds: [] }
  }

  // Use caching for frequently accessed data
  const cacheKey = `user_saved_ids:${user.id}`
  const cached = queryCache.get<string[]>(cacheKey)
  if (cached) {
    return { articleIds: cached }
  }

  const { data } = await supabase
    .from('saved_articles')
    .select('article_id')
    .eq('user_id', user.id)

  const articleIds = data?.map(item => item.article_id) || []
  
  // Cache for 5 minutes
  queryCache.set(cacheKey, articleIds, 300)

  return { articleIds }
}

export async function getArticleSaveCount(articleId: string) {
  const cacheKey = `save_count:${articleId}`
  const cached = queryCache.get<number>(cacheKey)
  if (cached !== null) {
    return { count: cached }
  }

  const supabase = await createClient()
  const { count } = await supabase
    .from('saved_articles')
    .select('*', { count: 'exact', head: true })
    .eq('article_id', articleId)

  const saveCount = count || 0
  
  // Cache for 10 minutes
  queryCache.set(cacheKey, saveCount, 600)

  return { count: saveCount }
}
