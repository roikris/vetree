'use client'

import { useEffect, useState } from 'react'

type SaveCountProps = {
  articleId: string
}

export function SaveCount({ articleId }: SaveCountProps) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/articles/${articleId}/save-count`)
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(data => setCount(data.count))
      .catch(() => setCount(0))
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
