'use client'

import { useState } from 'react'

type ArticleSummaryProps = {
  summary: string
  maxChars?: number
  expandedByDefault?: boolean
}

export function ArticleSummary({
  summary,
  maxChars = 250,
  expandedByDefault = false
}: ArticleSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(expandedByDefault)
  const shouldTruncate = summary.length > maxChars

  const displayText = isExpanded || !shouldTruncate
    ? summary
    : summary.slice(0, maxChars) + '...'

  return (
    <div>
      <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
        {displayText}
      </p>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] text-sm mt-2 font-medium transition-colors"
        >
          {isExpanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}
