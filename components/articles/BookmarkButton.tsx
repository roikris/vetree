'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSavedArticles } from '@/lib/hooks/useSavedArticles'

type BookmarkButtonProps = {
  articleId: string
}

export function BookmarkButton({ articleId }: BookmarkButtonProps) {
  const { user } = useAuth()
  const { isSaved, toggleSave } = useSavedArticles()
  const [isToggling, setIsToggling] = useState(false)

  if (!user) {
    return null // Don't show bookmark if not logged in
  }

  const saved = isSaved(articleId)

  const handleClick = async () => {
    setIsToggling(true)
    await toggleSave(articleId)
    setIsToggling(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={isToggling}
      className="group relative p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
      aria-label={saved ? 'Remove from library' : 'Save to library'}
      title={saved ? 'Remove from library' : 'Save to library'}
      data-onboarding="bookmark"
    >
      {saved ? (
        // Filled bookmark (saved)
        <svg
          className="w-5 h-5 text-[#3D7A5F] dark:text-[#4E9A78]"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
        </svg>
      ) : (
        // Empty bookmark (not saved)
        <svg
          className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-[#3D7A5F] dark:group-hover:text-[#4E9A78] transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
        </svg>
      )}
    </button>
  )
}
