'use server'

import { createClient } from '@/lib/supabase/server'
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

  revalidatePath('/library')
  return { success: true }
}

export async function getSavedArticles() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { articles: [], error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('saved_articles')
    .select(`
      article_id,
      saved_at,
      articles (*)
    `)
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false })

  if (error) {
    return { articles: [], error: error.message }
  }

  // Extract articles from the join result and filter to only enriched articles
  const articles = data
    ?.map((item: any) => item.articles)
    .filter(Boolean)
    .filter((article: any) =>
      article.needs_enrichment === false &&
      article.summary !== null &&
      article.clinical_bottom_line !== null
    ) || []

  return { articles, error: null }
}

export async function getUserSavedArticleIds() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { articleIds: [] }
  }

  const { data } = await supabase
    .from('saved_articles')
    .select('article_id')
    .eq('user_id', user.id)

  const articleIds = data?.map(item => item.article_id) || []

  return { articleIds }
}

export async function getArticleSaveCount(articleId: string) {
  const supabase = await createClient()

  const { count } = await supabase
    .from('saved_articles')
    .select('*', { count: 'exact', head: true })
    .eq('article_id', articleId)

  return { count: count || 0 }
}
