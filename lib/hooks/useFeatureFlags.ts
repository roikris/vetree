'use client'

import { useEffect, useState } from 'react'

type FeatureFlag = {
  id: string
  flag_name: string
  enabled: boolean
  updated_at: string
  updated_by: string | null
}

type FeatureFlagsCache = {
  flags: Record<string, boolean>
  timestamp: number
}

const CACHE_KEY = 'vetree_feature_flags'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function useFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFlags() {
      try {
        // Check cache first
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const parsedCache: FeatureFlagsCache = JSON.parse(cached)
          const now = Date.now()

          // Use cache if still valid
          if (now - parsedCache.timestamp < CACHE_TTL) {
            setFlags(parsedCache.flags)
            setLoading(false)
            return
          }
        }

        // Fetch from API
        const response = await fetch('/api/admin/feature-flags')
        if (!response.ok) {
          console.error('[useFeatureFlags] Failed to fetch flags')
          setLoading(false)
          return
        }

        const data = await response.json()
        const flagsMap: Record<string, boolean> = {}

        data.flags.forEach((flag: FeatureFlag) => {
          flagsMap[flag.flag_name] = flag.enabled
        })

        // Update state
        setFlags(flagsMap)

        // Cache the result
        const cacheData: FeatureFlagsCache = {
          flags: flagsMap,
          timestamp: Date.now()
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))

      } catch (error) {
        console.error('[useFeatureFlags] Error fetching flags:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFlags()
  }, [])

  return { flags, loading }
}

export function isFeatureEnabled(flags: Record<string, boolean>, flagName: string): boolean {
  return flags[flagName] ?? false
}

// Clear cache (useful after admin updates)
export function clearFeatureFlagsCache() {
  localStorage.removeItem(CACHE_KEY)
}
