'use client'

import { useState } from 'react'
import { ArticleSummary } from './ArticleSummary'

type LazySummaryProps = {
  articleId: string
  initialSummary?: string | null
}

export function LazySummary({ articleId, initialSummary }: LazySummaryProps) {
  const [summary, setSummary] = useState<string | null>(initialSummary ?? null)
  const [loading, setLoading] = useState(false)

  // If we already have a summary, render it directly
  if (summary) {
    return <ArticleSummary summary={summary} expandedByDefault={false} />
  }

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/articles/${articleId}/summary`)
      const data = await res.json()
      if (data.summary) setSummary(data.summary)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={fetchSummary}
      disabled={loading}
      className="text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] text-sm font-medium transition-colors disabled:opacity-50"
    >
      {loading ? 'Loading summary…' : 'Show summary ↓'}
    </button>
  )
}
