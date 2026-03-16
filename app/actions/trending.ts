'use server'

import { getTrendingArticleData } from '@/lib/queries'

export async function getTrendingArticles() {
  return getTrendingArticleData(7)
}
