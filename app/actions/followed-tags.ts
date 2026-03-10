'use server'

import { createClient } from '@/lib/supabase/server'

export async function getFollowedTags() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { tags: [], error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('followed_tags')
    .select('tag')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[get-followed-tags] Error:', error)
    return { tags: [], error: error.message }
  }

  return { tags: data?.map(ft => ft.tag) || [], error: null }
}
