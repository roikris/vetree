'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

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

  // Use admin client to count real users from auth.users
  const adminClient = createAdminClient()

  // Get ALL users from auth.users (handle pagination)
  let allUsers: any[] = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage
    })

    if (error) break
    if (!data.users || data.users.length === 0) break

    allUsers = allUsers.concat(data.users)

    // If we got fewer than perPage, we're done
    if (data.users.length < perPage) break
    page++
  }

  const totalUsers = allUsers.length

  // Get new users this week
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const newUsersThisWeek = allUsers.filter(u => {
    const createdAt = new Date(u.created_at)
    return createdAt >= oneWeekAgo
  }).length

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

  // Use admin client to get ALL users from auth.users (handle pagination)
  const adminClient = createAdminClient()

  let allAuthUsers: any[] = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage
    })

    if (error) {
      return { users: [], error: error.message }
    }

    if (!data.users || data.users.length === 0) break

    allAuthUsers = allAuthUsers.concat(data.users)

    // If we got fewer than perPage, we're done
    if (data.users.length < perPage) break
    page++
  }

  // Get user roles from user_roles table
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('user_id, role, created_at')

  // Create a map of user_id to role
  const roleMap = new Map(
    (userRoles || []).map(r => [r.user_id, r.role])
  )

  // Combine auth users with their roles
  const users = allAuthUsers.map(authUser => ({
    user_id: authUser.id,
    email: authUser.email,
    created_at: authUser.created_at,
    role: roleMap.get(authUser.id) || 'user', // Default to 'user' if no role set
    confirmed: authUser.email_confirmed_at !== null
  }))

  // Sort by created_at descending
  users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return { users, error: null }
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

  // Check if user already has a role entry
  const { data: existingRole } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('user_id', userId)
    .single()

  if (existingRole) {
    // Update existing role
    const { error } = await supabase
      .from('user_roles')
      .update({ role })
      .eq('user_id', userId)

    if (error) {
      return { error: error.message }
    }
  } else {
    // Create new role entry
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role })

    if (error) {
      return { error: error.message }
    }
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
  // (3+ attempts, still needs enrichment, not currently queued for retry)
  const { count: failedEnrichment } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .gte('enrichment_attempts', 3)
    .eq('needs_enrichment', true)
    .neq('force_retry', true)

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

// Growth OS Actions
export async function getGrowthStats() {
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

  // Get current day number (earliest pending or done task)
  const { data: firstTask } = await supabase
    .from('growth_tasks')
    .select('day_number')
    .order('day_number', { ascending: true })
    .limit(1)
    .single()

  const { data: latestTask } = await supabase
    .from('growth_tasks')
    .select('day_number, status')
    .order('day_number', { ascending: false })
    .or('status.eq.done,status.eq.pending')
    .limit(1)
    .single()

  // Count completed tasks this week
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const { count: completedThisWeek } = await supabase
    .from('growth_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'done')
    .gte('completed_at', oneWeekAgo.toISOString())

  // Count total done
  const { count: totalDone } = await supabase
    .from('growth_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'done')

  // Get platforms covered this week
  const { data: platformsThisWeek } = await supabase
    .from('growth_tasks')
    .select('platform')
    .eq('status', 'done')
    .gte('completed_at', oneWeekAgo.toISOString())

  const uniquePlatforms = platformsThisWeek
    ? [...new Set(platformsThisWeek.map(t => t.platform))]
    : []

  return {
    stats: {
      currentDay: latestTask?.day_number || 1,
      totalDays: 90,
      completedThisWeek: completedThisWeek || 0,
      totalDone: totalDone || 0,
      platformsThisWeek: uniquePlatforms,
    },
    error: null
  }
}

export async function getGrowthTasks({
  startDate,
  endDate,
  status,
}: {
  startDate?: string
  endDate?: string
  status?: 'pending' | 'done' | 'skipped'
}) {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { tasks: [], error: 'Not authenticated' }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { tasks: [], error: 'Unauthorized' }
  }

  let query = supabase
    .from('growth_tasks')
    .select('*')
    .order('scheduled_date', { ascending: true })

  if (startDate) {
    query = query.gte('scheduled_date', startDate)
  }
  if (endDate) {
    query = query.lte('scheduled_date', endDate)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data: tasks, error } = await query

  if (error) {
    return { tasks: [], error: error.message }
  }

  return { tasks: tasks || [], error: null }
}

export async function getTodaysTasks() {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { tasks: [], error: 'Not authenticated' }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { tasks: [], error: 'Unauthorized' }
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: tasks, error } = await supabase
    .from('growth_tasks')
    .select('*')
    .eq('scheduled_date', today)
    .order('day_number', { ascending: true })

  if (error) {
    return { tasks: [], error: error.message }
  }

  return { tasks: tasks || [], error: null }
}

export async function updateGrowthTask({
  taskId,
  status,
  notes,
}: {
  taskId: string
  status: 'done' | 'skipped'
  notes?: string
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

  const updateData: any = { status }

  if (status === 'done') {
    updateData.completed_at = new Date().toISOString()
  }

  if (notes !== undefined) {
    updateData.notes = notes
  }

  const { error } = await supabase
    .from('growth_tasks')
    .update(updateData)
    .eq('id', taskId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
