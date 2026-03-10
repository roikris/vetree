'use server'

import { createClient } from '@/lib/supabase/server'
import { Article } from '@/lib/supabase'

export async function getPersonalizedArticles() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { articles: [], hasFollowedTags: false }
  }

  // Get user's followed tags
  const { data: followedTagsData } = await supabase
    .from('followed_tags')
    .select('tag')
    .eq('user_id', user.id)

  const followedTags = followedTagsData?.map(ft => ft.tag) || []

  if (followedTags.length === 0) {
    return { articles: [], hasFollowedTags: false }
  }

  // Fetch articles matching any of the user's followed tags
  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .eq('needs_enrichment', false)
    .not('clinical_bottom_line', 'is', null)
    .not('summary', 'is', null)
    .overlaps('labels', followedTags)
    .order('publication_date', { ascending: false })
    .limit(5)

  if (error) {
    console.error('[personalized-feed] Error:', error)
    return { articles: [], hasFollowedTags: true }
  }

  return {
    articles: (articles || []) as Article[],
    hasFollowedTags: true
  }
}
