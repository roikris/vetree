import { getAdminStats } from '@/app/actions/admin'
import { getReports } from '@/app/actions/reports'
import Link from 'next/link'

export default async function AdminOverviewPage() {
  const { stats, error: statsError } = await getAdminStats()
  const { reports } = await getReports()

  const recentReports = reports.slice(0, 5)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          Admin Overview
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Welcome to the Vetree admin dashboard
        </p>
      </div>

      {statsError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200 text-sm">
            Error loading stats: {statsError}
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Total Users</span>
            <span className="text-2xl">👥</span>
          </div>
          <div className="text-3xl font-bold text-[#3D7A5F] dark:text-[#4E9A78]">
            {stats?.totalUsers || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">New This Week</span>
            <span className="text-2xl">🆕</span>
          </div>
          <div className="text-3xl font-bold text-[#3D7A5F] dark:text-[#4E9A78]">
            {stats?.newUsersThisWeek || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Total Articles</span>
            <span className="text-2xl">📚</span>
          </div>
          <div className="text-3xl font-bold text-[#3D7A5F] dark:text-[#4E9A78]">
            {stats?.totalArticles || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Pending Enrichment</span>
            <span className="text-2xl">⏳</span>
          </div>
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-500">
            {stats?.pendingEnrichment || 0}
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Reports */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              Recent Reports
            </h2>
            <Link
              href="/admin/reports"
              className="text-sm text-[#3D7A5F] dark:text-[#4E9A78] hover:underline"
            >
              View All →
            </Link>
          </div>

          {recentReports.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">No reports yet</p>
          ) : (
            <div className="space-y-3">
              {recentReports.map((report: any) => {
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'open':
                      return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                    case 'in_progress':
                      return 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
                    case 'resolved':
                      return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                    default:
                      return 'bg-zinc-100 dark:bg-zinc-900/20 text-zinc-800 dark:text-zinc-200'
                  }
                }

                return (
                  <div key={report.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                    <div className="flex items-start justify-between mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-[#1A1A1A] dark:text-[#E8E8E8] line-clamp-2">
                      {report.description}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pipeline Status */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              Pipeline Status
            </h2>
            <Link
              href="/admin/pipeline"
              className="text-sm text-[#3D7A5F] dark:text-[#4E9A78] hover:underline"
            >
              View Details →
            </Link>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-zinc-200 dark:border-zinc-800">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Pending Enrichment</span>
              <span className="text-lg font-semibold text-amber-600 dark:text-amber-500">
                {stats?.pendingEnrichment || 0}
              </span>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-zinc-200 dark:border-zinc-800">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Total Articles</span>
              <span className="text-lg font-semibold text-[#3D7A5F] dark:text-[#4E9A78]">
                {stats?.totalArticles || 0}
              </span>
            </div>

            <div className="pt-2">
              <Link
                href="/admin/pipeline"
                className="block w-full text-center px-4 py-2 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white rounded-lg hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] transition-colors text-sm font-medium"
              >
                Manage Pipeline
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
