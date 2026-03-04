'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendPasswordResetEmail() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function getUserStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { stats: null, error: 'Not authenticated' }
  }

  // Get total saved articles count
  const { count: totalSaved } = await supabase
    .from('saved_articles')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Get saved articles with their labels to find most common specialty
  const { data: savedArticles } = await supabase
    .from('saved_articles')
    .select(`
      articles (labels)
    `)
    .eq('user_id', user.id)

  // Count label occurrences
  const labelCounts: Record<string, number> = {}
  savedArticles?.forEach((item: any) => {
    const labels = item.articles?.labels || []
    labels.forEach((label: string) => {
      labelCounts[label] = (labelCounts[label] || 0) + 1
    })
  })

  // Find most common label
  let mostSavedLabel = null
  let maxCount = 0
  for (const [label, count] of Object.entries(labelCounts)) {
    if (count > maxCount) {
      maxCount = count
      mostSavedLabel = label
    }
  }

  // Calculate days since account creation
  const createdAt = new Date(user.created_at)
  const now = new Date()
  const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

  return {
    stats: {
      totalSaved: totalSaved || 0,
      mostSavedLabel,
      daysSinceCreation,
      memberSince: createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    },
    error: null
  }
}
