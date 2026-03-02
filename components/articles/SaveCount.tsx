'use client'

import { useEffect, useState } from 'react'
import { getArticleSaveCount } from '@/app/actions/saved-articles'

type SaveCountProps = {
  articleId: string
}

export function SaveCount({ articleId }: SaveCountProps) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    async function loadCount() {
      const { count } = await getArticleSaveCount(articleId)
      setCount(count)
    }
    loadCount()
  }, [articleId])

  if (count === null || count === 0) {
    return null
  }

  return (
    <span className="text-xs text-zinc-500 dark:text-zinc-400">
      Saved by {count} {count === 1 ? 'user' : 'users'}
    </span>
  )
}
