'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type FollowTagButtonProps = {
  tag: string
}

export function FollowTagButton({ tag }: FollowTagButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    checkFollowStatus()
  }, [tag])

  async function checkFollowStatus() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIsLoggedIn(false)
      return
    }

    setIsLoggedIn(true)

    const { data } = await supabase
      .from('followed_tags')
      .select('id')
      .eq('user_id', user.id)
      .eq('tag', tag)
      .single()

    setIsFollowing(!!data)
  }

  async function toggleFollow() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setIsLoading(true)

    if (isFollowing) {
      // Unfollow
      await fetch('/api/tags/unfollow', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag })
      })
      setIsFollowing(false)
    } else {
      // Follow
      await fetch('/api/tags/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag })
      })
      setIsFollowing(true)
    }

    setIsLoading(false)
  }

  if (!isLoggedIn) return null

  return (
    <button
      onClick={toggleFollow}
      disabled={isLoading}
      className={`ml-1.5 text-xs px-2 py-0.5 rounded-full transition-colors ${
        isFollowing
          ? 'text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88]'
          : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
      }`}
      title={isFollowing ? 'Click to unfollow' : 'Get weekly digest for this topic'}
    >
      {isFollowing ? '✓' : '+'}
    </button>
  )
}
