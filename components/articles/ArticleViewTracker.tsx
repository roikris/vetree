'use client'

import { useEffect } from 'react'
import { trackArticleView } from '@/components/ui/RegistrationWall'

type ArticleViewTrackerProps = {
  isLoggedIn: boolean
}

export function ArticleViewTracker({ isLoggedIn }: ArticleViewTrackerProps) {
  useEffect(() => {
    if (!isLoggedIn) {
      trackArticleView()
    }
  }, [isLoggedIn])

  return null
}
