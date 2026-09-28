'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useAuth } from './useAuth'
import { subscribe, getSnapshot, syncUser, toggleSaveFor } from './savedArticlesStore'

/**
 * Bookmark state for any component, backed by one shared store (lib/hooks/savedArticlesStore.ts):
 * one GET /api/saved-articles per signed-in user per page session — never a per-row server
 * action, which queued ahead of navigations and held a new search for 10–15 s.
 */
export function useSavedArticles() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Only after auth has resolved (a freshly mounted hook briefly sees user=null). The store
  // dedupes across instances; dep is the user id, so TOKEN_REFRESHED does not refetch.
  useEffect(() => {
    if (!authLoading) syncUser(userId)
  }, [authLoading, userId])

  const toggleSave = async (articleId: string) => {
    if (!user) return { error: 'Not authenticated' }
    return toggleSaveFor(user.id, articleId)
  }

  const current = s.userId === userId
  const ids = current ? s.ids : new Set<string>()
  const isSaved = (articleId: string) => ids.has(articleId)
  const loading = authLoading || (userId ? (!current || s.loading) : false)

  return { savedArticleIds: ids, isSaved, toggleSave, loading }
}
