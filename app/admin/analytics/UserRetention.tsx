'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type RetentionData = {
  dau_today: number
  wau: number
  mau: number
  retention_7d: number
  retention_30d: number
  churned_users: number
  avg_days_between_visits: number
  top_returning_users: Array<{
    email: string
    active_days: number
    last_seen: string
    days_since_last_visit: number
  }>
  daily_active_users: Array<{
    date: string
    users: number
  }>
  total_users: number
  stickiness: number
}

export function UserRetention() {
  const [data, setData] = useState<RetentionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUsers, setShowUsers] = useState(false)

  useEffect(() => {
    loadRetentionData()
  }, [])

  const loadRetentionData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/analytics/retention')
      if (!response.ok) {
        throw new Error('Failed to load retention data')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split('@')
    if (!localPart || !domain) return email
    return `${localPart[0]}***@${domain}`
  }

  const getUserStatus = (daysSince: number) => {
    if (daysSince < 3) return { badge: '🟢', label: 'Active', color: 'text-green-600 dark:text-green-400' }
    if (daysSince < 14) return { badge: '🟡', label: 'At risk', color: 'text-yellow-600 dark:text-yellow-400' }
    return { badge: '🔴', label: 'Churned', color: 'text-red-600 dark:text-red-400' }
  }

  const getRetentionColor = (retention: number) => {
    if (retention >= 40) return 'text-green-600 dark:text-green-400'
    if (retention >= 20) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getStickinessColor = (stickiness: number) => {
    if (stickiness >= 20) return 'text-green-600 dark:text-green-400'
    if (stickiness >= 10) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          User Retention
        </h2>
        <div className="flex items-center justify-center py-8 text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          User Retention
        </h2>
        <div className="text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
          User Retention
        </h2>
        <button
          onClick={loadRetentionData}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Row 1 - Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">DAU Today</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
            {data.dau_today}
          </div>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">WAU (7-day)</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
            {data.wau}
          </div>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">MAU (30-day)</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
            {data.mau}
          </div>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
            DAU/MAU (Stickiness)
          </div>
          <div className={`text-2xl font-bold ${getStickinessColor(data.stickiness)}`}>
            {data.stickiness}%
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {data.stickiness >= 20 ? 'Excellent' : data.stickiness >= 10 ? 'Good' : 'Needs work'}
          </div>
        </div>
      </div>

      {/* Row 2 - Retention Rates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">7-Day Retention</div>
          <div className={`text-2xl font-bold ${getRetentionColor(data.retention_7d)}`}>
            {data.retention_7d}%
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {data.retention_7d >= 40 ? '✓ Strong' : data.retention_7d >= 20 ? '⚠ Fair' : '✗ Weak'}
          </div>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">30-Day Retention</div>
          <div className={`text-2xl font-bold ${getRetentionColor(data.retention_30d)}`}>
            {data.retention_30d}%
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {data.retention_30d >= 40 ? '✓ Strong' : data.retention_30d >= 20 ? '⚠ Fair' : '✗ Weak'}
          </div>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Churned Users</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-500">
            {data.churned_users}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            14+ days inactive
          </div>
        </div>
      </div>

      {/* Row 3 - DAU Chart */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-3">
          Daily Active Users (Last 30 Days)
        </h3>
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.daily_active_users}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => {
                  const d = new Date(date)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
                stroke="#9ca3af"
              />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <Line
                type="monotone"
                dataKey="users"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 4 - Top Returning Users */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
            Top Returning Users ({data.top_returning_users.length})
          </h3>
          <button
            onClick={() => setShowUsers(!showUsers)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            {showUsers ? 'Hide' : 'View'}
          </button>
        </div>

        {showUsers && (
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Active Days
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Last Seen
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {data.top_returning_users.map((user, index) => {
                    const status = getUserStatus(user.days_since_last_visit)
                    return (
                      <tr key={index} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 font-mono text-xs">
                          {maskEmail(user.email)}
                        </td>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                          {user.active_days} days
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {new Date(user.last_seen).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs ${status.color}`}>
                            <span>{status.badge}</span>
                            <span>{status.label}</span>
                            {user.days_since_last_visit > 0 && (
                              <span className="text-zinc-500 dark:text-zinc-400">
                                ({user.days_since_last_visit}d)
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Additional Stats */}
      <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          <span>Total registered users: {data.total_users}</span>
          <span className="mx-2">•</span>
          <span>Avg. days between visits: {data.avg_days_between_visits}</span>
        </div>
      </div>
    </div>
  )
}
