import { getReports } from '@/app/actions/reports'
import { AdminReportsClient } from './AdminReportsClient'

export default async function AdminReportsPage() {
  // Get all reports
  const { reports, error } = await getReports()

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          Reports Management
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Review and manage user-submitted reports
        </p>
      </div>

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
          <div className="text-3xl font-bold text-red-600 dark:text-red-500 mb-1">
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
  )
}
