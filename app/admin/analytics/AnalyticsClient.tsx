'use client'

import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getAnalyticsOverview, getTopPages, getVisitorsOverTime, getTopArticles } from '@/app/actions/analytics'

type AnalyticsClientProps = {
  initialOverview: any
  initialTopPages: any[]
  initialVisitorsOverTime: any[]
  initialTopArticles: any[]
}

export function AnalyticsClient({
  initialOverview,
  initialTopPages,
  initialVisitorsOverTime,
  initialTopArticles
}: AnalyticsClientProps) {
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(7)
  const [overview, setOverview] = useState(initialOverview)
  const [topPages, setTopPages] = useState(initialTopPages || [])
  const [visitorsOverTime, setVisitorsOverTime] = useState(initialVisitorsOverTime || [])
  const [topArticles, setTopArticles] = useState(initialTopArticles || [])
  const [isLoading, setIsLoading] = useState(false)

  const handleDateRangeChange = async (newRange: 7 | 30 | 90) => {
    setDateRange(newRange)
    setIsLoading(true)

    try {
      const [overviewRes, topPagesRes, visitorsRes, articlesRes] = await Promise.all([
        getAnalyticsOverview(newRange),
        getTopPages(newRange),
        getVisitorsOverTime(newRange),
        getTopArticles(newRange)
      ])

      setOverview(overviewRes.data)
      setTopPages(topPagesRes.data || [])
      setVisitorsOverTime(visitorsRes.data || [])
      setTopArticles(articlesRes.data || [])
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Date Range Filter */}
      <div className="flex gap-2">
        {[7, 30, 90].map((days) => (
          <button
            key={days}
            onClick={() => handleDateRangeChange(days as 7 | 30 | 90)}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              dateRange === days
                ? 'bg-[#3D7A5F] dark:bg-[#4E9A78] text-white'
                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'
            }`}
          >
            {days === 7 ? 'Last 7 Days' : days === 30 ? 'Last 30 Days' : 'Last 90 Days'}
          </button>
        ))}
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Total Pageviews</div>
            <div className="text-3xl font-bold text-[#3D7A5F] dark:text-[#4E9A78]">
              {overview.totalViews.toLocaleString()}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Unique Visitors</div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-500">
              {overview.uniqueVisitors.toLocaleString()}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Logged In</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-500">
              {overview.loggedInViews.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {overview.totalViews > 0
                ? `${Math.round((overview.loggedInViews / overview.totalViews) * 100)}% of total`
                : '0%'}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Anonymous</div>
            <div className="text-3xl font-bold text-zinc-600 dark:text-zinc-400">
              {overview.anonymousViews.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {overview.totalViews > 0
                ? `${Math.round((overview.anonymousViews / overview.totalViews) * 100)}% of total`
                : '0%'}
            </div>
          </div>
        </div>
      )}

      {/* Visitors Over Time Chart */}
      {visitorsOverTime.length > 0 && (
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
            Visitors Over Time
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={visitorsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="date" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1A1A',
                  border: '1px solid #333',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="totalViews" stroke="#3D7A5F" name="Total Views" />
              <Line type="monotone" dataKey="uniqueVisitors" stroke="#2563EB" name="Unique Visitors" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Pages Chart */}
      {topPages.length > 0 && (
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
            Top Pages
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topPages} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis type="number" stroke="#888" />
              <YAxis dataKey="path" type="category" width={150} stroke="#888" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1A1A',
                  border: '1px solid #333',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="views" fill="#3D7A5F" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Articles Table */}
      {topArticles.length > 0 && (
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
            Top Articles
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Title
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Views
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Unique Visitors
                  </th>
                </tr>
              </thead>
              <tbody>
                {topArticles.map((article, idx) => (
                  <tr
                    key={article.id}
                    className="border-b border-zinc-200 dark:border-zinc-800 last:border-0"
                  >
                    <td className="py-3 px-4 text-sm text-zinc-900 dark:text-zinc-100">
                      <a
                        href={`/article/${article.id}`}
                        className="hover:text-[#3D7A5F] dark:hover:text-[#4E9A78] transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {article.title}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-zinc-700 dark:text-zinc-300 font-medium">
                      {article.views}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-zinc-700 dark:text-zinc-300">
                      {article.uniqueVisitors}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
