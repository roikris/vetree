'use client'

import { useState, useEffect } from 'react'

export function IncompleteEnrichment() {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [fixing, setFixing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadCount()
  }, [])

  const loadCount = async () => {
    try {
      const response = await fetch('/api/admin/incomplete-count')
      const data = await response.json()

      if (data.error) {
        console.error('Error loading count:', data.error)
      } else {
        setCount(data.count)
      }
    } catch (error) {
      console.error('Error loading count:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFixAll = async () => {
    if (!confirm(`This will re-queue ${count} articles for enrichment. Continue?`)) {
      return
    }

    setFixing(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/fix-incomplete', {
        method: 'POST'
      })

      const data = await response.json()

      if (data.error) {
        setMessage({ type: 'error', text: data.error })
      } else {
        setMessage({ type: 'success', text: data.message })
        // Reload count after fix
        setTimeout(() => {
          loadCount()
          setMessage(null)
        }, 2000)
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to fix incomplete articles' })
    } finally {
      setFixing(false)
    }
  }

  if (loading) {
    return null
  }

  if (count === 0 || count === null) {
    return null
  }

  return (
    <div className="mb-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
            ⚠️ Incomplete Enrichment Detected
          </h3>
          <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
            <strong>{count.toLocaleString()} articles</strong> are marked as enriched but are missing the clinical bottom line field.
            These articles were incorrectly marked as complete and are currently hidden from users.
          </p>
          <p className="text-xs text-orange-700 dark:text-orange-300 mb-4">
            This was caused by a bug in the enrichment script that marked articles as done after 3 attempts,
            even if enrichment was incomplete. The bug has been fixed.
          </p>

          {message && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
            }`}>
              {message.text}
            </div>
          )}

          <button
            onClick={handleFixAll}
            disabled={fixing}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {fixing ? 'Re-queueing...' : `🔄 Re-queue ${count} Articles`}
          </button>
        </div>

        <div className="text-right">
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-500">
            {count.toLocaleString()}
          </div>
          <div className="text-xs text-orange-700 dark:text-orange-400 mt-1">
            incomplete articles
          </div>
        </div>
      </div>
    </div>
  )
}
