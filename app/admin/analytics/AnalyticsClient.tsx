'use client'

import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getAnalyticsOverview, getTopPages, getVisitorsOverTime, getTopArticles, getSessionDuration, getRecentSearches, getDeviceBreakdown, getTopCountries } from '@/app/actions/analytics'

type AnalyticsClientProps = {
  initialOverview: any
  initialTopPages: any[]
  initialVisitorsOverTime: any[]
  initialTopArticles: any[]
  initialSessionDuration: any
  initialRecentSearches: any[]
  initialDeviceBreakdown: any
  initialTopCountries: any[]
}

export function AnalyticsClient({
  initialOverview,
  initialTopPages,
  initialVisitorsOverTime,
  initialTopArticles,
  initialSessionDuration,
  initialRecentSearches,
  initialDeviceBreakdown,
  initialTopCountries
}: AnalyticsClientProps) {
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(7)
  const [overview, setOverview] = useState(initialOverview)
  const [topPages, setTopPages] = useState(initialTopPages || [])
  const [visitorsOverTime, setVisitorsOverTime] = useState(initialVisitorsOverTime || [])
  const [topArticles, setTopArticles] = useState(initialTopArticles || [])
  const [sessionDuration, setSessionDuration] = useState(initialSessionDuration)
  const [recentSearches, setRecentSearches] = useState(initialRecentSearches || [])
  const [deviceBreakdown, setDeviceBreakdown] = useState(initialDeviceBreakdown)
  const [topCountries, setTopCountries] = useState(initialTopCountries || [])
  const [isLoading, setIsLoading] = useState(false)

  const handleDateRangeChange = async (newRange: 7 | 30 | 90) => {
    setDateRange(newRange)
    setIsLoading(true)

    try {
      const [overviewRes, topPagesRes, visitorsRes, articlesRes, sessionRes, searchesRes, deviceRes, countriesRes] = await Promise.all([
        getAnalyticsOverview(newRange),
        getTopPages(newRange),
        getVisitorsOverTime(newRange),
        getTopArticles(newRange),
        getSessionDuration(newRange),
        getRecentSearches(newRange),
        getDeviceBreakdown(newRange),
        getTopCountries(newRange)
      ])

      setOverview(overviewRes.data)
      setTopPages(topPagesRes.data || [])
      setVisitorsOverTime(visitorsRes.data || [])
      setTopArticles(articlesRes.data || [])
      setSessionDuration(sessionRes.data)
      setRecentSearches(searchesRes.data || [])
      setDeviceBreakdown(deviceRes.data)
      setTopCountries(countriesRes.data || [])
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Format session duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Convert country code to flag emoji
  const getCountryFlag = (countryCode: string) => {
    if (countryCode === 'Unknown' || !countryCode || countryCode.length !== 2) {
      return '🌐'
    }
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0))
    return String.fromCodePoint(...codePoints)
  }

  // Prepare pie chart data for session duration
  const sessionPieData = sessionDuration ? [
    { name: '<1 min', value: sessionDuration.distribution.under1min, color: '#ef4444' },
    { name: '1-3 min', value: sessionDuration.distribution.between1and3, color: '#f59e0b' },
    { name: '3-10 min', value: sessionDuration.distribution.between3and10, color: '#3b82f6' },
    { name: '10+ min', value: sessionDuration.distribution.over10min, color: '#10b981' }
  ] : []

  // Prepare pie chart data for device breakdown
  const devicePieData = deviceBreakdown ? [
    { name: 'Mobile', value: deviceBreakdown.mobile, color: '#3b82f6' },
    { name: 'Desktop', value: deviceBreakdown.desktop, color: '#10b981' },
    { name: 'Unknown', value: deviceBreakdown.unknown, color: '#6b7280' }
  ].filter(d => d.value > 0) : []

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

      {/* Session Duration */}
      {sessionDuration && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Average Duration Card */}
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Average Session Duration
            </h2>
            <div className="text-5xl font-bold text-[#3D7A5F] dark:text-[#4E9A78]">
              {formatDuration(sessionDuration.average)}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
              minutes:seconds
            </div>
          </div>

          {/* Duration Distribution */}
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Session Duration Distribution
            </h2>
            {sessionPieData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={sessionPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {sessionPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-zinc-500 dark:text-zinc-400">
                No session data yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Device Breakdown & Top Countries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Breakdown Pie Chart */}
        {deviceBreakdown && (
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Device Breakdown
            </h2>
            {devicePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={devicePieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {devicePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-zinc-500 dark:text-zinc-400">
                No device data yet
              </div>
            )}
          </div>
        )}

        {/* Top Countries */}
        {topCountries && topCountries.length > 0 && (
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Top Countries
            </h2>
            <div className="space-y-2">
              {topCountries.map((country, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getCountryFlag(country.country)}</span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {country.country}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-zinc-700 dark:text-zinc-300">
                      <span className="font-medium">{country.views}</span> views
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {country.uniqueVisitors} unique
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Searches */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Recent Searches
        </h2>
        {recentSearches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Query
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Times Searched
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Avg Results
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Last Searched
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentSearches.map((search, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-zinc-200 dark:border-zinc-800 last:border-0"
                  >
                    <td className="py-3 px-4 text-sm text-zinc-900 dark:text-zinc-100 font-mono">
                      {search.query}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-zinc-700 dark:text-zinc-300 font-medium">
                      {search.count}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-zinc-700 dark:text-zinc-300">
                      {search.avgResults}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-zinc-500 dark:text-zinc-400">
                      {new Date(search.lastSearched).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
            No searches recorded yet
          </div>
        )}
      </div>
    </div>
  )
}
