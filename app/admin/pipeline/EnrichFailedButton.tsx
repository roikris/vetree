'use client'

import { useState } from 'react'

export function EnrichFailedButton() {
  const [isEnriching, setIsEnriching] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleEnrichFailed = async () => {
    setIsEnriching(true)
    setMessage(null)

    try {
      const response = await fetch('/api/enrich-failed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to enrich articles'
        })
        return
      }

      setMessage({
        type: 'success',
        text: data.message || `${data.count} articles queued for enrichment retry`
      })

    } catch (error) {
      console.error('Error enriching failed articles:', error)
      setMessage({
        type: 'error',
        text: 'An error occurred. Please try again.'
      })
    } finally {
      setIsEnriching(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleEnrichFailed}
        disabled={isEnriching}
        className="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <span>🔄</span>
        {isEnriching ? 'Enriching...' : 'Enrich Failed'}
      </button>

      {message && (
        <div className={`mt-3 p-3 rounded-lg text-xs ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
