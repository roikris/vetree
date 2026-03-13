'use client'

import { useState, useEffect } from 'react'
import { clearFeatureFlagsCache } from '@/lib/hooks/useFeatureFlags'

type FeatureFlag = {
  id: string
  flag_name: string
  enabled: boolean
  updated_at: string
  updated_by: string | null
}

export function FeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    fetchFlags()
  }, [])

  async function fetchFlags() {
    try {
      const response = await fetch('/api/admin/feature-flags')
      if (!response.ok) throw new Error('Failed to fetch flags')

      const data = await response.json()
      setFlags(data.flags || [])
    } catch (error) {
      console.error('[FeatureFlags] Error fetching flags:', error)
    } finally {
      setLoading(false)
    }
  }

  async function toggleFlag(flagName: string, currentlyEnabled: boolean) {
    setUpdating(flagName)

    try {
      const response = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flag_name: flagName,
          enabled: !currentlyEnabled
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update flag')
      }

      // Clear frontend cache so users get updated flag immediately
      clearFeatureFlagsCache()

      // Optimistic update
      setFlags(prev => prev.map(f =>
        f.flag_name === flagName
          ? { ...f, enabled: !currentlyEnabled, updated_at: new Date().toISOString() }
          : f
      ))

    } catch (error) {
      console.error('[FeatureFlags] Error updating flag:', error)
      alert('Failed to update feature flag')
    } finally {
      setUpdating(null)
    }
  }

  const formatFlagName = (flagName: string) => {
    const names: Record<string, string> = {
      'topic_synthesis': '🔬 Topic Synthesis'
    }
    return names[flagName] || flagName
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-48 mb-4"></div>
          <div className="h-12 bg-zinc-100 dark:bg-zinc-900 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Feature Flags
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Control feature availability across the platform
        </p>
      </div>

      {/* Flags list */}
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {flags.map(flag => (
          <div
            key={flag.id}
            className="px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatFlagName(flag.flag_name)}
                </h3>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  flag.enabled
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}>
                  {flag.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Last updated: {formatDate(flag.updated_at)}
              </p>
            </div>

            {/* Toggle switch */}
            <button
              onClick={() => toggleFlag(flag.flag_name, flag.enabled)}
              disabled={updating === flag.flag_name}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#3D7A5F] focus:ring-offset-2 ${
                flag.enabled
                  ? 'bg-[#3D7A5F] dark:bg-[#4E9A78]'
                  : 'bg-zinc-200 dark:bg-zinc-700'
              } ${updating === flag.flag_name ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  flag.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {flags.length === 0 && (
        <div className="px-6 py-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            No feature flags configured
          </p>
        </div>
      )}
    </div>
  )
}
