'use client'

import { useState } from 'react'
import { requeueNeverAttempted, requeuePartialAttempts, forceRetryFailed, quarantineUnfixable } from '@/app/actions/admin'

type ArticleHealthProps = {
  diagnostics: {
    data?: {
      totalArticles: number
      visibleArticles: number
      pendingEnrichment: number
      enrichedButNoContent: number
      permanentlyFailed: number
      neverAttempted: number
      partiallyAttempted: number
    }
    error?: string | null
  }
}

export function ArticleHealth({ diagnostics }: ArticleHealthProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  const handleAction = async (action: () => Promise<any>, successMessage: string) => {
    if (!confirm(`Are you sure? This will modify articles in the database.`)) return

    setIsProcessing(true)
    setMessage(null)

    try {
      const result = await action()

      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: `${successMessage} (${result.count} articles affected)` })
        // Refresh page after 2 seconds to show updated counts
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch (error) {
      setMessage({ type: 'error', text: String(error) })
    } finally {
      setIsProcessing(false)
    }
  }

  if (diagnostics.error) {
    return (
      <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-800 dark:text-red-200">
          Error loading diagnostics: {diagnostics.error}
        </p>
      </div>
    )
  }

  if (!diagnostics.data) {
    return null
  }

  const { data } = diagnostics
  const hiddenArticles = data.totalArticles - data.visibleArticles

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
        📊 Article Health Diagnostics
      </h2>

      {/* Overview Alert */}
      {hiddenArticles > 0 && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-amber-900 dark:text-amber-200 font-semibold">
            ⚠️ {hiddenArticles.toLocaleString()} articles ({Math.round((hiddenArticles / data.totalArticles) * 100)}%) are hidden from users
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Articles */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Total Articles</div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {data.totalArticles.toLocaleString()}
          </div>
        </div>

        {/* Card 2: Visible to Users */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Visible to Users</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-500">
            {data.visibleArticles.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {data.totalArticles > 0 ? Math.round((data.visibleArticles / data.totalArticles) * 100) : 0}% of total
          </div>
        </div>

        {/* Card 3: Pending Enrichment */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Pending Enrichment</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
            {data.pendingEnrichment.toLocaleString()}
          </div>
        </div>

        {/* Card 4: Enriched But No Content */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Enriched Flag But No Content</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">
            {data.enrichedButNoContent.toLocaleString()}
          </div>
        </div>

        {/* Card 5: Permanently Failed */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Permanently Failed</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-500">
            {data.permanentlyFailed.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            attempts ≥ 3, force_retry = false
          </div>
        </div>

        {/* Card 6: Never Attempted */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Never Attempted</div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-500">
            {data.neverAttempted.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            attempts = 0
          </div>
        </div>

        {/* Card 7: Partially Attempted */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Partially Attempted</div>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-500">
            {data.partiallyAttempted.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            attempts 1-2
          </div>
        </div>

        {/* Card 8: Hidden from Users */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Hidden from Users</div>
          <div className="text-2xl font-bold text-zinc-600 dark:text-zinc-400">
            {hiddenArticles.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {data.totalArticles > 0 ? Math.round((hiddenArticles / data.totalArticles) * 100) : 0}% of total
          </div>
        </div>
      </div>

      {/* Action Buttons Section */}
      <div className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          🛠️ Recovery Actions
        </h3>

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-3 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            onClick={() => handleAction(requeueNeverAttempted, 'Re-queued never attempted articles')}
            disabled={isProcessing || data.neverAttempted === 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white disabled:text-zinc-500 dark:disabled:text-zinc-400 rounded-lg text-sm transition-colors disabled:cursor-not-allowed"
          >
            Re-queue Never Attempted ({data.neverAttempted})
          </button>
          <button
            onClick={() => handleAction(requeuePartialAttempts, 'Re-queued partially attempted articles')}
            disabled={isProcessing || data.partiallyAttempted === 0}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white disabled:text-zinc-500 dark:disabled:text-zinc-400 rounded-lg text-sm transition-colors disabled:cursor-not-allowed"
          >
            Re-queue Partial ({data.partiallyAttempted})
          </button>
          <button
            onClick={() => handleAction(forceRetryFailed, 'Force retrying failed articles')}
            disabled={isProcessing || data.permanentlyFailed === 0}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white disabled:text-zinc-500 dark:disabled:text-zinc-400 rounded-lg text-sm transition-colors disabled:cursor-not-allowed"
          >
            Force Retry Failed ({data.permanentlyFailed})
          </button>
          <button
            onClick={() => handleAction(quarantineUnfixable, 'Quarantined unfixable articles')}
            disabled={isProcessing}
            className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white disabled:text-zinc-500 dark:disabled:text-zinc-400 rounded-lg text-sm transition-colors disabled:cursor-not-allowed"
          >
            Quarantine Unfixable
          </button>
        </div>

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          💡 Tip: Re-queue actions set needs_enrichment=true. Quarantine marks articles with attempts≥3 AND no abstract.
        </p>
      </div>
    </div>
  )
}
