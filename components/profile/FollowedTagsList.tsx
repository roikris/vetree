'use client'

import { useState } from 'react'
import Link from 'next/link'

type FollowedTagsListProps = {
  initialTags: string[]
}

export function FollowedTagsList({ initialTags }: FollowedTagsListProps) {
  const [tags, setTags] = useState(initialTags)
  const [removingTag, setRemovingTag] = useState<string | null>(null)

  async function removeTag(tag: string) {
    setRemovingTag(tag)

    try {
      await fetch('/api/tags/unfollow', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag })
      })

      setTags(tags.filter(t => t !== tag))
    } catch (error) {
      console.error('[remove-tag] Error:', error)
    } finally {
      setRemovingTag(null)
    }
  }

  if (tags.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Follow tags on articles to personalize your weekly digest
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] font-medium transition-colors"
        >
          Browse articles →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#3D7A5F]/10 dark:bg-[#4E9A78]/10 text-[#3D7A5F] dark:text-[#4E9A78] text-sm font-medium rounded-full border border-[#3D7A5F]/20 dark:border-[#4E9A78]/20"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            disabled={removingTag === tag}
            className="hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] transition-colors"
            aria-label={`Unfollow ${tag}`}
          >
            {removingTag === tag ? '...' : '×'}
          </button>
        </span>
      ))}
    </div>
  )
}
