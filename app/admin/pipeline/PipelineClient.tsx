'use client'

import { useState } from 'react'

type PipelineClientProps = {
  pendingCount: number
}

export function PipelineClient({ pendingCount }: PipelineClientProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleRunEnrichment = async () => {
    setIsRunning(true)
    setMessage(null)

    try {
      const response = await fetch('/api/trigger-enrichment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to trigger enrichment workflow'
        })
        return
      }

      setMessage({
        type: 'success',
        text: data.message || 'Enrichment workflow triggered successfully! Check GitHub Actions for progress.'
      })

    } catch (error) {
      console.error('Error triggering enrichment:', error)
      setMessage({
        type: 'error',
        text: 'An error occurred. Please try again.'
      })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Run Enrichment Card */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Manual Enrichment Trigger
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Manually trigger the enrichment pipeline to process pending articles. This will start a GitHub Actions workflow.
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={handleRunEnrichment}
            disabled={isRunning || pendingCount === 0}
            className="px-6 py-3 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white rounded-lg hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isRunning ? 'Running...' : `Run Enrichment (${pendingCount} pending)`}
          </button>
          {pendingCount === 0 && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              No articles pending enrichment
            </span>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Recent Activity
        </h2>
        <div className="space-y-3">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">
                Daily Sync
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Automated
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Runs daily at 2:00 AM UTC to fetch new articles
            </p>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">
                Enrichment Pipeline
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Manual/Automated
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Processes articles to add clinical insights and summaries
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
          ℹ️ Pipeline Information
        </h3>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>
            <strong>Daily Sync:</strong> Automatically fetches new articles from configured sources every day
          </p>
          <p>
            <strong>Enrichment:</strong> Uses AI to generate clinical bottom lines and summaries for articles
          </p>
          <p>
            <strong>Failed Attempts:</strong> Articles that fail enrichment 3+ times may need manual review
          </p>
        </div>
      </div>
    </div>
  )
}
