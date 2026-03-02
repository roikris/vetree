'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { saveArticle, unsaveArticle, getUserSavedArticleIds } from '@/app/actions/saved-articles'

export function useSavedArticles() {
  const { user } = useAuth()
  const [savedArticleIds, setSavedArticleIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setSavedArticleIds(new Set())
      setLoading(false)
      return
    }

    async function loadSavedArticles() {
      const { articleIds } = await getUserSavedArticleIds()
      setSavedArticleIds(new Set(articleIds))
      setLoading(false)
    }

    loadSavedArticles()
  }, [user])

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

    // Call server action
    const result = isSaved
      ? await unsaveArticle(articleId)
      : await saveArticle(articleId)

    if (result.error) {
      // Revert on error
      setSavedArticleIds(savedArticleIds)
      return { error: result.error }
    }

    return { success: true }
  }

  const isSaved = (articleId: string) => savedArticleIds.has(articleId)

  return { savedArticleIds, isSaved, toggleSave, loading }
}
