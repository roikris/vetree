'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

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
