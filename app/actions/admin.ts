'use server'

import { createClient } from '@/lib/supabase/server'

export async function getAdminStats() {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  // Get total users count (unique users who have saved articles + users with roles)
  const { count: totalUsers } = await supabase
    .from('user_roles')
    .select('*', { count: 'exact', head: true })

  // Get new users this week
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const { count: newUsersThisWeek } = await supabase
    .from('user_roles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneWeekAgo.toISOString())

  // Get total articles
  const { count: totalArticles } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })

  // Get articles pending enrichment (if column exists)
  const { count: pendingEnrichment } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', true)

  return {
    stats: {
      totalUsers: totalUsers || 0,
      newUsersThisWeek: newUsersThisWeek || 0,
      totalArticles: totalArticles || 0,
      pendingEnrichment: pendingEnrichment || 0,
    },
    error: null
  }
}

export async function getAllUsers() {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { users: [], error: 'Not authenticated' }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { users: [], error: 'Unauthorized' }
  }

  // Get all user roles with saved article counts
  const { data: users, error } = await supabase
    .from('user_roles')
    .select(`
      user_id,
      role,
      created_at
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return { users: [], error: error.message }
  }

  // Get emails from auth.users (requires service role or custom RPC)
  // For now, return without emails - would need RPC function to get auth.users data
  return { users: users || [], error: null }
}

export async function updateUserRole({
  userId,
  role,
}: {
  userId: string
  role: 'user' | 'admin'
}) {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('user_roles')
    .update({ role })
    .eq('user_id', userId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function getPipelineStats() {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  // Get articles pending enrichment
  const { count: pendingEnrichment } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', true)

  // Get articles with failed enrichment that still need attention
  const { count: failedEnrichment } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .gte('enrichment_attempts', 3)
    .eq('needs_enrichment', true)

  // Get most recent article (proxy for last sync)
  const { data: recentArticle } = await supabase
    .from('articles')
    .select('publication_date, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return {
    stats: {
      pendingEnrichment: pendingEnrichment || 0,
      failedEnrichment: failedEnrichment || 0,
      lastSyncDate: recentArticle?.created_at || null,
    },
    error: null
  }
}
