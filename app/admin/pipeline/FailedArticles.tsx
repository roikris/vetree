'use client'

import { useState, useEffect } from 'react'
import { getFailedArticles } from '@/app/actions/admin'

type FailedArticle = {
  id: string
  title: string
  enrichment_attempts: number
  last_enrichment_error: string | null
  last_enrichment_at: string | null
  abstract: string | null
}

export function FailedArticles() {
  const [articles, setArticles] = useState<FailedArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadFailedArticles()
  }, [])

  const loadFailedArticles = async () => {
    setLoading(true)
    const result = await getFailedArticles(20)

    if (result.error) {
      setError(result.error)
    } else {
      setArticles(result.data)
    }

    setLoading(false)
  }

  const getErrorColor = (errorMessage: string | null) => {
    if (!errorMessage) return 'text-zinc-500 dark:text-zinc-400'

    const lowerError = errorMessage.toLowerCase()

    // Rate limit errors - yellow (temporary, will retry)
    if (lowerError.includes('rate limit') || lowerError.includes('too many requests')) {
      return 'text-yellow-700 dark:text-yellow-500'
    }

    // Abstract/null errors - red (no content, candidate for quarantine)
    if (lowerError.includes('abstract') || lowerError.includes('null') || lowerError.includes('no json')) {
      return 'text-red-700 dark:text-red-500'
    }

    // Other errors - orange
    return 'text-orange-700 dark:text-orange-500'
  }

  const getErrorIcon = (errorMessage: string | null) => {
    if (!errorMessage) return '❓'

    const lowerError = errorMessage.toLowerCase()

    if (lowerError.includes('rate limit') || lowerError.includes('too many requests')) {
      return '⏱️' // Temporary
    }

    if (lowerError.includes('abstract') || lowerError.includes('null') || lowerError.includes('no json')) {
      return '🚫' // No content
    }

    return '⚠️' // Other error
  }

  const truncateError = (error: string | null, maxLength: number = 100) => {
    if (!error) return 'No error message'
    if (error.length <= maxLength) return error
    return error.substring(0, maxLength) + '...'
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Failed Articles (3+ Attempts)
        </h2>
        <div className="flex items-center justify-center py-8 text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Failed Articles (3+ Attempts)
        </h2>
        <div className="text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Failed Articles (3+ Attempts)
        </h2>
        <div className="flex items-center justify-center py-8 text-zinc-500 dark:text-zinc-400">
          No failed articles found! 🎉
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
          Failed Articles (3+ Attempts)
        </h2>
        <button
          onClick={loadFailedArticles}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
        <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium mb-2">Error Types:</div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span>⏱️</span>
            <span className="text-yellow-700 dark:text-yellow-500">Rate Limit (temporary)</span>
          </span>
          <span className="flex items-center gap-1">
            <span>🚫</span>
            <span className="text-red-700 dark:text-red-500">No Content (quarantine candidate)</span>
          </span>
          <span className="flex items-center gap-1">
            <span>⚠️</span>
            <span className="text-orange-700 dark:text-orange-500">Other Errors</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Title
              </th>
              <th className="text-center py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Attempts
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Last Error
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Last Tried
              </th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr
                key={article.id}
                className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <td className="py-3 px-4">
                  <a
                    href={`/article/${article.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-zinc-900 dark:text-zinc-100 hover:text-[#3D7A5F] dark:hover:text-[#4E9A78] transition-colors line-clamp-2"
                  >
                    {article.title}
                  </a>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-semibold">
                    {article.enrichment_attempts}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {getErrorIcon(article.last_enrichment_error)}
                    </span>
                    <span
                      className={`text-sm font-mono ${getErrorColor(article.last_enrichment_error)}`}
                      title={article.last_enrichment_error || 'No error message'}
                    >
                      {truncateError(article.last_enrichment_error, 80)}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-zinc-500 dark:text-zinc-400">
                  {article.last_enrichment_at
                    ? new Date(article.last_enrichment_at).toLocaleString()
                    : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {articles.length >= 20 && (
        <div className="mt-4 text-xs text-center text-zinc-500 dark:text-zinc-400">
          Showing first 20 failed articles. Use recovery actions above to retry or quarantine.
        </div>
      )}
    </div>
  )
}
