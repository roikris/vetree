'use client'

import { useState, useEffect } from 'react'
import { getFailedArticles } from '@/app/actions/admin'

type FailedArticle = {
  id: string
  title: string
  enrichment_attempts: number
  last_enrichment_error: string | null
  last_enrichment_at: string | null
  labels: string[] | null
  article_url: string | null
  doi: string | null
}

export function FailedArticles() {
  const [articles, setArticles] = useState<FailedArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingLabels, setEditingLabels] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [editedLabels, setEditedLabels] = useState<string[]>([])

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

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete this article permanently?\n\n"${title}"`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/articles/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete article')
      }

      // Remove from UI
      setArticles(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      alert('Failed to delete article: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const startEditingLabels = (articleId: string, currentLabels: string[] | null) => {
    setEditingLabels(articleId)
    setEditedLabels(currentLabels || [])
    setNewLabel('')
  }

  const addLabel = () => {
    const trimmed = newLabel.trim()
    if (trimmed && !editedLabels.includes(trimmed)) {
      setEditedLabels([...editedLabels, trimmed])
      setNewLabel('')
    }
  }

  const removeLabel = (label: string) => {
    setEditedLabels(editedLabels.filter(l => l !== label))
  }

  const saveLabels = async (articleId: string) => {
    try {
      const response = await fetch(`/api/admin/articles/${articleId}/labels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: editedLabels })
      })

      if (!response.ok) {
        throw new Error('Failed to save labels')
      }

      // Update in UI
      setArticles(prev => prev.map(a =>
        a.id === articleId
          ? { ...a, labels: editedLabels, enrichment_attempts: 0 }
          : a
      ))

      setEditingLabels(null)

      // Reload to show updated state
      setTimeout(() => loadFailedArticles(), 1000)
    } catch (err) {
      alert('Failed to save labels: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const cancelEditingLabels = () => {
    setEditingLabels(null)
    setEditedLabels([])
    setNewLabel('')
  }

  const getErrorColor = (errorMessage: string | null) => {
    if (!errorMessage) return 'text-zinc-500 dark:text-zinc-400'

    const lowerError = errorMessage.toLowerCase()

    if (lowerError.includes('rate limit') || lowerError.includes('too many requests')) {
      return 'text-yellow-700 dark:text-yellow-500'
    }

    if (lowerError.includes('abstract') || lowerError.includes('null') || lowerError.includes('no json')) {
      return 'text-red-700 dark:text-red-500'
    }

    return 'text-orange-700 dark:text-orange-500'
  }

  const getErrorIcon = (errorMessage: string | null) => {
    if (!errorMessage) return '❓'

    const lowerError = errorMessage.toLowerCase()

    if (lowerError.includes('rate limit') || lowerError.includes('too many requests')) {
      return '⏱️'
    }

    if (lowerError.includes('abstract') || lowerError.includes('null') || lowerError.includes('no json')) {
      return '🚫'
    }

    return '⚠️'
  }

  const truncateError = (error: string | null, maxLength: number = 80) => {
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

      <div className="space-y-4">
        {articles.map((article) => (
          <div
            key={article.id}
            className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            {/* Title row */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                {article.article_url || article.doi ? (
                  <a
                    href={article.article_url || `https://doi.org/${article.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline line-clamp-2"
                  >
                    {article.title}
                  </a>
                ) : (
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
                    {article.title}
                  </h3>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-semibold flex-shrink-0">
                  {article.enrichment_attempts}
                </span>
              </div>
            </div>

            {/* Labels row */}
            <div className="mb-3">
              {editingLabels === article.id ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editedLabels.map(label => (
                      <span
                        key={label}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full flex items-center gap-1"
                      >
                        {label}
                        <button
                          onClick={() => removeLabel(label)}
                          className="hover:text-red-600 dark:hover:text-red-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addLabel()}
                      placeholder="Type label and press Enter"
                      className="flex-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={addLabel}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveLabels(article.id)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      Save Labels & Retry
                    </button>
                    <button
                      onClick={cancelEditingLabels}
                      className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap gap-2 flex-1">
                    {article.labels && article.labels.length > 0 ? (
                      article.labels.map(label => (
                        <span
                          key={label}
                          className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded-full"
                        >
                          {label}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">No labels</span>
                    )}
                  </div>
                  <button
                    onClick={() => startEditingLabels(article.id, article.labels)}
                    className="px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs font-medium transition-colors flex-shrink-0"
                  >
                    Edit Labels
                  </button>
                </div>
              )}
            </div>

            {/* Error row */}
            <div className="flex items-start gap-2 mb-3">
              <span className="text-lg flex-shrink-0 mt-0.5">
                {getErrorIcon(article.last_enrichment_error)}
              </span>
              <span
                className={`text-xs font-mono ${getErrorColor(article.last_enrichment_error)}`}
                title={article.last_enrichment_error || 'No error message'}
              >
                {truncateError(article.last_enrichment_error, 120)}
              </span>
            </div>

            {/* Actions row */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Last tried: {article.last_enrichment_at
                  ? new Date(article.last_enrichment_at).toLocaleString()
                  : 'Never'}
              </span>
              {/* ISSUE 1a FIX: Delete button */}
              <button
                onClick={() => handleDelete(article.id, article.title)}
                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded text-xs font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {articles.length >= 20 && (
        <div className="mt-4 text-xs text-center text-zinc-500 dark:text-zinc-400">
          Showing first 20 failed articles. Use recovery actions to retry or delete.
        </div>
      )}
    </div>
  )
}
