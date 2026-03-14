'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

let cachedFollowedTags: Set<string> | null = null
let cachedUserId: string | null = null

export function useFollowedTags() {
  const [followedTags, setFollowedTags] = useState<Set<string>>(cachedFollowedTags || new Set())
  const [isLoading, setIsLoading] = useState(!cachedFollowedTags)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadFollowedTags()
  }, [])

  async function loadFollowedTags() {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setIsLoggedIn(false)
      setIsLoading(false)
      return
    }

    setIsLoggedIn(true)

    // Use cache if same user
    if (cachedFollowedTags && cachedUserId === user.id) {
      setFollowedTags(cachedFollowedTags)
      setIsLoading(false)
      return
    }

    // Fetch all followed tags in a single query
    const { data } = await supabase
      .from('followed_tags')
      .select('tag')
      .eq('user_id', user.id)

    const tags = new Set(data?.map(r => r.tag) || [])

    // Cache for this session
    cachedFollowedTags = tags
    cachedUserId = user.id

    setFollowedTags(tags)
    setIsLoading(false)
  }

  function isFollowing(tag: string): boolean {
    return followedTags.has(tag)
  }

  function addTag(tag: string) {
    const newTags = new Set(followedTags)
    newTags.add(tag)
    setFollowedTags(newTags)
    cachedFollowedTags = newTags
  }

  function removeTag(tag: string) {
    const newTags = new Set(followedTags)
    newTags.delete(tag)
    setFollowedTags(newTags)
    cachedFollowedTags = newTags
  }

  return {
    followedTags,
    isFollowing,
    addTag,
    removeTag,
    isLoading,
    isLoggedIn,
    refresh: loadFollowedTags
  }
}
