'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { getUserSavedArticleIds } from '@/app/actions/saved-articles'

export function useSavedArticles() {
  const { user } = useAuth()
  const [savedArticleIds, setSavedArticleIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Dep is user?.id — not the full user object — so TOKEN_REFRESHED events
  // (same user ID, new session object) do not trigger a redundant refetch.
  useEffect(() => {
    if (!user) {
      setSavedArticleIds(new Set())
      setLoading(false)
      return
    }

    async function loadSavedArticles() {
      try {
        const { articleIds } = await getUserSavedArticleIds()
        setSavedArticleIds(new Set(articleIds))
      } finally {
        setLoading(false)
      }
    }

    loadSavedArticles()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSave = async (articleId: string) => {
    if (!user) return { error: 'Not authenticated' }

    const isSaved = savedArticleIds.has(articleId)

    // Optimistically update UI
    const newSavedIds = new Set(savedArticleIds)
    if (isSaved) {
      newSavedIds.delete(articleId)
    } else {
      newSavedIds.add(articleId)
    }
    setSavedArticleIds(newSavedIds)

    // Use plain fetch — bypasses Next.js sequential router action queue,
    // so save fires immediately even if getUserSavedArticleIds calls are pending.
    const res = await fetch('/api/save-article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, action: isSaved ? 'unsave' : 'save' }),
    })

    if (!res.ok) {
      // Revert optimistic update
      setSavedArticleIds(savedArticleIds)
      const data = await res.json().catch(() => ({}))
      return { error: data.error || `HTTP ${res.status}` }
    }

    return { success: true }
  }

  const isSaved = (articleId: string) => savedArticleIds.has(articleId)

  return { savedArticleIds, isSaved, toggleSave, loading }
}
