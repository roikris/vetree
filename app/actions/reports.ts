'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ReportType = 'article_issue' | 'bug' | 'other'

export async function submitReport({
  type,
  articleId,
  description,
}: {
  type: ReportType
  articleId?: string
  description: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to submit a report' }
  }

  const { error } = await supabase
    .from('reports')
    .insert({
      user_id: user.id,
      type,
      article_id: articleId || null,
      description,
      status: 'open'
    })

  if (error) {
    console.error('Error submitting report:', error)
    return { error: error.message }
  }

  return { success: true }
}

export async function getReports() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { reports: [], error: 'Not authenticated' }
  }

  // Check if user is admin
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isAdmin = roleData?.role === 'admin'

  // Admins see all reports, users see only their own
  let query = supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query

  if (error) {
    return { reports: [], error: error.message }
  }

  return { reports: data || [], error: null }
}

export async function updateReportStatus({
  reportId,
  status,
  adminNotes,
}: {
  reportId: string
  status: 'open' | 'in_progress' | 'resolved'
  adminNotes?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check if user is admin
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return { error: 'Unauthorized - Admin access required' }
  }

  const updateData: any = { status }
  if (adminNotes !== undefined) {
    updateData.admin_notes = adminNotes
  }

  const { error } = await supabase
    .from('reports')
    .update(updateData)
    .eq('id', reportId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/reports')
  return { success: true }
}
