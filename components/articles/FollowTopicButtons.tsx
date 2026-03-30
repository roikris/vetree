'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface FollowTopicButtonsProps {
  labels: string[]
  isLoggedIn: boolean
}

export function FollowTopicButtons({ labels, isLoggedIn }: FollowTopicButtonsProps) {
  const router = useRouter()
  const [followedTags, setFollowedTags] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<Set<string>>(new Set())

  const handleFollow = async (label: string) => {
    if (!isLoggedIn) {
      // Redirect to signup with return URL
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search)
      router.push(`/signup?return=${returnUrl}`)
      return
    }

    setLoading(prev => new Set([...prev, label]))

    try {
      const response = await fetch('/api/tags/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: label })
      })

      if (response.ok) {
        setFollowedTags(prev => new Set([...prev, label]))
      }
    } catch (error) {
      console.error('Failed to follow tag:', error)
    } finally {
      setLoading(prev => {
        const next = new Set(prev)
        next.delete(label)
        return next
      })
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-sm text-zinc-600 dark:text-zinc-400 mr-2">
        Follow topics:
      </span>
      {labels.map((label) => {
        const isFollowed = followedTags.has(label)
        const isLoading = loading.has(label)

        return (
          <button
            key={label}
            onClick={() => handleFollow(label)}
            disabled={isFollowed || isLoading}
            aria-label={isFollowed ? `Following ${label}` : `Follow ${label} topic`}
            aria-pressed={isFollowed}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              isFollowed
                ? 'bg-[#3D7A5F]/10 text-[#3D7A5F] border-[#3D7A5F]/20 cursor-default'
                : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-[#3D7A5F]/5 dark:hover:bg-[#3D7A5F]/10 hover:border-[#3D7A5F]/30'
            }`}
          >
            {isLoading ? '...' : isFollowed ? '✓ Following' : `+ Follow ${label}`}
          </button>
        )
      })}
    </div>
  )
}
