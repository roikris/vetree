'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requeueFailedArticles, FAILED_UNPUBLISHED_OR } from '@/lib/enrichment/requeueFailed'

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

  // Get latest marketing consent per user
  const { data: consents } = await supabase
    .from('user_consents')
    .select('user_id, marketing_opted_in, consented_at')
    .order('consented_at', { ascending: false })

  // Keep only the most recent consent per user
  const consentMap = new Map<string, boolean | null>()
  for (const c of (consents || [])) {
    if (!consentMap.has(c.user_id)) {
      consentMap.set(c.user_id, c.marketing_opted_in)
    }
  }

  // Combine auth users with their roles
  const users = allAuthUsers.map(authUser => ({
    user_id: authUser.id,
    email: authUser.email,
    created_at: authUser.created_at,
    role: roleMap.get(authUser.id) || 'user', // Default to 'user' if no role set
    confirmed: authUser.email_confirmed_at !== null,
    marketing_consent: consentMap.has(authUser.id) ? consentMap.get(authUser.id)! : null
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
  // (the set "Retry failed" re-queues — lib/enrichment/requeueFailed.ts — not already queued for retry)
  const { count: failedEnrichment } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .not('abstract', 'is', null)
    .or(FAILED_UNPUBLISHED_OR)
    .not('force_retry', 'is', true)

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

  // Query 2: Visible articles — the public filter (supabase/CLAUDE.md), quarantine included
  const { count: visibleArticles } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')

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

  // Query 5: Permanently failed — the same set "Force Retry Failed" retries (lib/enrichment/requeueFailed.ts)
  const { count: permanentlyFailed } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .not('abstract', 'is', null)
    .or(FAILED_UNPUBLISHED_OR)
    .not('force_retry', 'is', true)

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

  // Only failed, unpublished articles — the old `attempts >= 3` matched ~320 live ones
  // (lib/enrichment/requeueFailed.ts, shared with /api/enrich-failed)
  try {
    const { requeued } = await requeueFailedArticles(createAdminClient())
    return { success: true, count: requeued }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
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
    .update({ quarantined: true, quarantine_reason: 'admin' })   // an admin's quarantine is never lifted by a retry
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

  // Failed articles with error details — the same set the counts and "Retry failed" use
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, enrichment_attempts, last_enrichment_error, last_enrichment_at, labels, article_url, doi')
    .not('abstract', 'is', null)
    .or(FAILED_UNPUBLISHED_OR)
    .not('force_retry', 'is', true)   // already queued for retry: not "failed" any more
    .order('last_enrichment_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data: articles || [], error: null }
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
