'use client'

import { useState } from 'react'
import { updateReportStatus } from '@/app/actions/reports'
import { useRouter } from 'next/navigation'

type Report = {
  id: string
  user_id: string | null
  type: string
  article_id: string | null
  description: string
  status: string
  admin_notes: string | null
  created_at: string
  updated_at: string
}

type AdminReportsClientProps = {
  initialReports: Report[]
}

export function AdminReportsClient({ initialReports }: AdminReportsClientProps) {
  const router = useRouter()
  const [reports, setReports] = useState(initialReports)
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all')
  const [expandedReport, setExpandedReport] = useState<string | null>(null)
  const [updatingReport, setUpdatingReport] = useState<string | null>(null)

  const filteredReports = filter === 'all'
    ? reports
    : reports.filter(r => r.status === filter)

  const handleStatusChange = async (reportId: string, newStatus: 'open' | 'in_progress' | 'resolved') => {
    setUpdatingReport(reportId)

    const result = await updateReportStatus({ reportId, status: newStatus })

    if (result.error) {
      alert('Error updating report: ' + result.error)
    } else {
      // Update local state
      setReports(reports.map(r =>
        r.id === reportId ? { ...r, status: newStatus } : r
      ))
      router.refresh()
    }

    setUpdatingReport(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
      case 'in_progress':
        return 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
      case 'resolved':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800'
      default:
        return 'bg-zinc-100 dark:bg-zinc-900/20 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'article_issue':
        return 'Article Issue'
      case 'bug':
        return 'Bug Report'
      case 'other':
        return 'Other'
      default:
        return type
    }
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-800">
        {(['all', 'open', 'in_progress', 'resolved'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
              filter === status
                ? 'text-[#3D7A5F] dark:text-[#4E9A78] border-b-2 border-[#3D7A5F] dark:border-[#4E9A78]'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-[#3D7A5F] dark:hover:text-[#4E9A78]'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ')}
            {status !== 'all' && (
              <span className="ml-1.5 text-xs">
                ({reports.filter(r => r.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="text-center py-16">
          <svg
            className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-zinc-600 dark:text-zinc-400">
            No {filter !== 'all' && filter.replace('_', ' ')} reports found
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(report.status)}`}>
                      {report.status.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {getTypeLabel(report.type)}
                    </span>
                    {report.article_id && (
                      <a
                        href={`/article/${report.article_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#3D7A5F] dark:text-[#4E9A78] hover:underline"
                      >
                        View Article →
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Reported {new Date(report.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                <button
                  onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  <svg
                    className={`w-5 h-5 transition-transform ${expandedReport === report.id ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-[#1A1A1A] dark:text-[#E8E8E8]">
                  {report.description}
                </p>
              </div>

              {expandedReport === report.id && (
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mt-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusChange(report.id, 'open')}
                      disabled={updatingReport === report.id || report.status === 'open'}
                      className="px-3 py-1.5 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Mark Open
                    </button>
                    <button
                      onClick={() => handleStatusChange(report.id, 'in_progress')}
                      disabled={updatingReport === report.id || report.status === 'in_progress'}
                      className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      In Progress
                    </button>
                    <button
                      onClick={() => handleStatusChange(report.id, 'resolved')}
                      disabled={updatingReport === report.id || report.status === 'resolved'}
                      className="px-3 py-1.5 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
