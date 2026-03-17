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

export async function getArticleHealthDiagnostics() {
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

  // Query 1: Total articles
  const { count: totalArticles } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })

  // Query 2: Visible articles (needs_enrichment = false AND summary IS NOT NULL AND clinical_bottom_line IS NOT NULL)
  const { count: visibleArticles } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)

  // Query 3: Pending enrichment (needs_enrichment = true)
  const { count: pendingEnrichment } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', true)

  // Query 4: Enriched flag but no content (needs_enrichment = false but summary IS NULL)
  const { count: enrichedButNoContent } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', false)
    .is('summary', null)

  // Query 5: Permanently failed (enrichment_attempts >= 3 AND force_retry = false)
  const { count: permanentlyFailed } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .gte('enrichment_attempts', 3)
    .eq('force_retry', false)

  // Query 6: Never attempted (enrichment_attempts = 0)
  const { count: neverAttempted } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('enrichment_attempts', 0)

  // Query 7: Partially attempted (enrichment_attempts between 1-2)
  const { count: partiallyAttempted } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('enrichment_attempts', [1, 2])

  return {
    data: {
      totalArticles: totalArticles || 0,
      visibleArticles: visibleArticles || 0,
      pendingEnrichment: pendingEnrichment || 0,
      enrichedButNoContent: enrichedButNoContent || 0,
      permanentlyFailed: permanentlyFailed || 0,
      neverAttempted: neverAttempted || 0,
      partiallyAttempted: partiallyAttempted || 0
    },
    error: null
  }
}

export async function requeueNeverAttempted() {
  const supabase = await createClient()

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

  const { count, error } = await supabase
    .from('articles')
    .update({ needs_enrichment: true })
    .eq('enrichment_attempts', 0)

  if (error) {
    return { error: error.message }
  }

  return { success: true, count: count || 0 }
}

export async function requeuePartialAttempts() {
  const supabase = await createClient()

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

  const { count, error } = await supabase
    .from('articles')
    .update({ needs_enrichment: true })
    .in('enrichment_attempts', [1, 2])

  if (error) {
    return { error: error.message }
  }

  return { success: true, count: count || 0 }
}

export async function forceRetryFailed() {
  const supabase = await createClient()

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

  const { count, error } = await supabase
    .from('articles')
    .update({
      needs_enrichment: true,
      force_retry: true
    })
    .gte('enrichment_attempts', 3)
    .eq('force_retry', false)

  if (error) {
    return { error: error.message }
  }

  return { success: true, count: count || 0 }
}

export async function quarantineUnfixable() {
  const supabase = await createClient()

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

  // Use admin client to bypass RLS for quarantine update
  const adminSupabase = createAdminClient()

  // Quarantine articles with 3+ attempts AND no clinical_bottom_line (enrichment failed)
  const { count, error } = await adminSupabase
    .from('articles')
    .update({ quarantined: true })
    .gte('enrichment_attempts', 3)
    .is('clinical_bottom_line', null)

  if (error) {
    return { error: error.message }
  }

  return { success: true, count: count || 0 }
}

export async function getFailedArticles(limit: number = 20) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', data: [] }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { error: 'Unauthorized', data: [] }
  }

  // Fetch failed articles (attempts >= 3) with error details
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, enrichment_attempts, last_enrichment_error, last_enrichment_at, labels, article_url, doi')
    .gte('enrichment_attempts', 3)
    .eq('needs_enrichment', true)
    .order('last_enrichment_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data: articles || [], error: null }
}

export async function getCampaignStats() {
  const supabase = await createClient()

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

  // Count completed tasks
  const { count: totalDone } = await supabase
    .from('growth_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'done')

  // Get last 7 days to check streak
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: recentTasks } = await supabase
    .from('growth_tasks')
    .select('scheduled_date, status, platform')
    .gte('scheduled_date', sevenDaysAgo.toISOString().split('T')[0])
    .order('scheduled_date', { ascending: false })

  // Calculate streak (consecutive days with completed tasks)
  let streak = 0
  if (recentTasks) {
    const today = new Date().toISOString().split('T')[0]
    const sortedDates = [...new Set(recentTasks.map(t => t.scheduled_date))].sort().reverse()

    for (let i = 0; i < sortedDates.length; i++) {
      const dateToCheck = new Date()
      dateToCheck.setDate(dateToCheck.getDate() - i)
      const expectedDate = dateToCheck.toISOString().split('T')[0]

      const taskOnDate = recentTasks.find(t => t.scheduled_date === expectedDate && t.status === 'done')
      if (taskOnDate) {
        streak++
      } else if (expectedDate !== today) {
        // Don't break streak if today's task isn't done yet
        break
      }
    }
  }

  // Get platforms covered this week
  const platformsThisWeek = recentTasks
    ? [...new Set(recentTasks.filter(t => t.status === 'done').map(t => t.platform))]
    : []

  return {
    stats: {
      totalDone: totalDone || 0,
      streak,
      platformsThisWeek
    },
    error: null
  }
}

export async function getTodaysTask() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { task: null, error: 'Not authenticated' }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { task: null, error: 'Unauthorized' }
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: task } = await supabase
    .from('growth_tasks')
    .select('*')
    .eq('scheduled_date', today)
    .single()

  return { task, error: null }
}

export async function markTaskComplete(taskId: string, content: string) {
  const supabase = await createClient()

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
    .from('growth_tasks')
    .update({
      status: 'done',
      content,
      completed_at: new Date().toISOString()
    })
    .eq('id', taskId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function createTodaysTask(dayNumber: number, platform: string, language: string) {
  const supabase = await createClient()

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

  const today = new Date().toISOString().split('T')[0]

  // Check if task already exists
  const { data: existingTask } = await supabase
    .from('growth_tasks')
    .select('*')
    .eq('scheduled_date', today)
    .single()

  if (existingTask) {
    return { task: existingTask, error: null }
  }

  // Create new task
  const { data: newTask, error } = await supabase
    .from('growth_tasks')
    .insert({
      day_number: dayNumber,
      scheduled_date: today,
      platform,
      language,
      status: 'pending',
      group_name: 'campaign'
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { task: newTask, error: null }
}

export async function getDigestRuns() {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', data: [] }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { error: 'Unauthorized', data: [] }
  }

  // Fetch last 5 digest runs
  const { data: runs, error } = await supabase
    .from('digest_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data: runs || [], error: null }
}
