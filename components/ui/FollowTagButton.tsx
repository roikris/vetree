'use client'

import { useState } from 'react'
import { useFollowedTags } from '@/lib/hooks/useFollowedTags'

type FollowTagButtonProps = {
  tag: string
}

export function FollowTagButton({ tag }: FollowTagButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { isFollowing, addTag, removeTag, isLoggedIn } = useFollowedTags()

  const following = isFollowing(tag)

  async function toggleFollow() {
    setIsLoading(true)

    if (following) {
      // Unfollow
      await fetch('/api/tags/unfollow', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag })
      })
      removeTag(tag)
    } else {
      // Follow
      await fetch('/api/tags/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag })
      })
      addTag(tag)
    }

    setIsLoading(false)
  }

  if (!isLoggedIn) return null

  return (
    <button
      onClick={toggleFollow}
      disabled={isLoading}
      className={`ml-1.5 text-xs px-2 py-0.5 rounded-full transition-colors ${
        following
          ? 'text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88]'
          : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
      }`}
      title={following ? 'Click to unfollow' : 'Get weekly digest for this topic'}
    >
      {following ? '✓' : '+'}
    </button>
  )
}
