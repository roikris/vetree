'use client'

import { useState, useEffect } from 'react'
import { getDigestRuns } from '@/app/actions/admin'

type DigestRun = {
  id: string
  created_at: string
  triggered_by: string
  sent_count: number
  skipped_count: number
  total_users: number
  run_time_ms: number
  status: 'success' | 'failed'
  error_message?: string | null
}

export function ScheduledJobs() {
  const [runs, setRuns] = useState<DigestRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [triggering, setTriggering] = useState<string | null>(null)

  useEffect(() => {
    loadRuns()
  }, [])

  const loadRuns = async () => {
    setLoading(true)
    const result = await getDigestRuns()

    if (result.error) {
      setError(result.error)
    } else {
      setRuns(result.data)
    }

    setLoading(false)
  }

  const triggerDigest = async () => {
    if (!confirm('Send weekly digest to all users with followed tags now?')) {
      return
    }

    setTriggering('digest')

    try {
      const response = await fetch('/api/admin/trigger-digest', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to trigger digest')
      }

      const result = await response.json()
      alert(`Digest sent successfully!\n\nSent: ${result.sentCount}\nSkipped: ${result.skippedCount}\nTotal users: ${result.totalUsers}`)

      // Reload runs
      setTimeout(() => loadRuns(), 1000)
    } catch (err) {
      alert('Failed to trigger digest: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setTriggering(null)
    }
  }

  const triggerReminder = async () => {
    alert('Daily reminder uses GitHub Actions and cannot be manually triggered from UI.\n\nTo run manually, go to:\nGitHub → Actions → Growth OS Daily Reminder → Run workflow')
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Scheduled Jobs
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
          Scheduled Jobs
        </h2>
        <div className="text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
          Scheduled Jobs
        </h2>
        <button
          onClick={loadRuns}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Job Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Weekly Digest */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-1">
                📧 Weekly Digest
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Runs Fridays 10:00 UTC (12:00 Israel)
              </p>
            </div>
            {runs.length > 0 && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                runs[0].status === 'success'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                {runs[0].status === 'success' ? '✓ OK' : '✗ Failed'}
              </span>
            )}
          </div>
          <div className="mb-3">
            {runs.length > 0 ? (
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                <div>Last run: {new Date(runs[0].created_at).toLocaleString()}</div>
                <div className="mt-1">Sent: {runs[0].sent_count} | Skipped: {runs[0].skipped_count}</div>
              </div>
            ) : (
              <div className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                No runs recorded yet
              </div>
            )}
          </div>
          <button
            onClick={triggerDigest}
            disabled={triggering === 'digest'}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded text-sm font-medium transition-colors"
          >
            {triggering === 'digest' ? 'Sending...' : 'Send Now'}
          </button>
        </div>

        {/* Daily Reminder */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-1">
                📱 Daily Reminder
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Runs daily 03:00 UTC (6:00 AM Israel)
              </p>
            </div>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
              Active
            </span>
          </div>
          <div className="mb-3">
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              Slack notification for Growth OS campaign
            </div>
          </div>
          <button
            onClick={triggerReminder}
            className="w-full px-3 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded text-sm font-medium transition-colors"
          >
            GitHub Actions Only
          </button>
        </div>
      </div>

      {/* Recent Digest Runs */}
      {runs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-3">
            Recent Digest Runs
          </h3>
          <div className="space-y-2">
            {runs.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                    run.status === 'success'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {run.status === 'success' ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <div className="text-xs text-zinc-900 dark:text-zinc-100">
                      {new Date(run.created_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {run.triggered_by === 'github-action' ? '🤖 Automated' : '👤 Manual'}
                      {run.status === 'success' ? (
                        <> · {run.sent_count} sent · {run.skipped_count} skipped</>
                      ) : (
                        <> · {run.error_message || 'Unknown error'}</>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-400 dark:text-zinc-500">
                    {(run.run_time_ms / 1000).toFixed(1)}s
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
