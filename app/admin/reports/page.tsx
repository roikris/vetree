import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getReports } from '@/app/actions/reports'
import { AdminReportsClient } from './AdminReportsClient'
import Link from 'next/link'

export default async function AdminReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login')
  }

  // Check if user is admin
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    redirect('/')
  }

  // Get all reports
  const { reports, error } = await getReports()

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] transition-colors mb-6"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Back to Search</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#3D7A5F] dark:bg-[#4E9A78] flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
            </div>

            <div>
              <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
                Admin Dashboard
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Manage user reports and issues
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200 text-sm">
              Error loading reports: {error}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-3xl font-bold text-[#3D7A5F] dark:text-[#4E9A78] mb-1">
              {reports.filter(r => r.status === 'open').length}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Open Reports
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-500 mb-1">
              {reports.filter(r => r.status === 'in_progress').length}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              In Progress
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-3xl font-bold text-green-600 dark:text-green-500 mb-1">
              {reports.filter(r => r.status === 'resolved').length}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Resolved
            </div>
          </div>
        </div>

        {/* Reports List */}
        <AdminReportsClient initialReports={reports} />
      </div>
    </div>
  )
}
