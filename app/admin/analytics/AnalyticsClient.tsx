'use client'

import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getAnalyticsOverview, getTopPages, getVisitorsOverTime, getTopArticles, getSessionDuration, getRecentSearches, getDeviceBreakdown, getTopCountries, getSavedArticlesStats, getTrafficSources, getSynthesisStats } from '@/app/actions/analytics'

type AnalyticsClientProps = {
  initialOverview: any
  initialTopPages: any[]
  initialVisitorsOverTime: any[]
  initialTopArticles: any[]
  initialSessionDuration: any
  initialRecentSearches: any[]
  initialDeviceBreakdown: any
  initialTopCountries: any[]
  initialSavedArticlesStats: any
  initialTrafficSources: any[]
  initialSynthesisStats: { totalRuns: number; totalHelpful: number } | null
}

export function AnalyticsClient({
  initialOverview,
  initialTopPages,
  initialVisitorsOverTime,
  initialTopArticles,
  initialSessionDuration,
  initialRecentSearches,
  initialDeviceBreakdown,
  initialTopCountries,
  initialSavedArticlesStats,
  initialTrafficSources,
  initialSynthesisStats
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
  const [savedArticlesStats, setSavedArticlesStats] = useState(initialSavedArticlesStats)
  const [trafficSources, setTrafficSources] = useState(initialTrafficSources || [])
  const [synthesisStats, setSynthesisStats] = useState(initialSynthesisStats)
  const [isLoading, setIsLoading] = useState(false)
  const [sortColumn, setSortColumn] = useState<'query' | 'count' | 'avg_results' | 'last_searched'>('count')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const sortedSearches = [...recentSearches].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1
    switch (sortColumn) {
      case 'query': return dir * a.query.localeCompare(b.query)
      case 'count': return dir * (a.count - b.count)
      case 'avg_results': return dir * (a.avgResults - b.avgResults)
      case 'last_searched': return dir * (new Date(a.lastSearched).getTime() - new Date(b.lastSearched).getTime())
      default: return 0
    }
  })

  const SortableHeader = ({ column, label }: { column: typeof sortColumn, label: string }) => (
    <th
      onClick={() => handleSort(column)}
      style={{
        padding: '10px 14px', textAlign: 'left', cursor: 'pointer', userSelect: 'none',
        fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 11, fontWeight: 600,
        letterSpacing: '.1em', textTransform: 'uppercase',
        color: sortColumn === column ? 'var(--al-accent)' : 'var(--al-mut4)',
        borderBottom: '1px solid rgba(var(--al-line, 62,54,36), .09)',
      }}
    >
      {label}{sortColumn === column ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  const handleDateRangeChange = async (newRange: 7 | 30 | 90) => {
    setDateRange(newRange)
    setIsLoading(true)

    try {
      const [overviewRes, topPagesRes, visitorsRes, articlesRes, sessionRes, searchesRes, deviceRes, countriesRes, savedRes, trafficRes, synthesisRes] = await Promise.all([
        getAnalyticsOverview(newRange),
        getTopPages(newRange),
        getVisitorsOverTime(newRange),
        getTopArticles(newRange),
        getSessionDuration(newRange),
        getRecentSearches(newRange),
        getDeviceBreakdown(newRange),
        getTopCountries(newRange),
        getSavedArticlesStats(newRange),
        getTrafficSources(newRange),
        getSynthesisStats(newRange)
      ])

      setOverview(overviewRes.data)
      setTopPages(topPagesRes.data || [])
      setVisitorsOverTime(visitorsRes.data || [])
      setTopArticles(articlesRes.data || [])
      setSessionDuration(sessionRes.data)
      setRecentSearches(searchesRes.data || [])
      setDeviceBreakdown(deviceRes.data)
      setTopCountries(countriesRes.data || [])
      setSavedArticlesStats(savedRes.data)
      setTrafficSources(trafficRes.data || [])
      setSynthesisStats(synthesisRes.data || null)
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Format session duration as "X min Y sec"
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs} sec`
    if (secs === 0) return `${mins} min`
    return `${mins} min ${secs} sec`
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

  // Flat bar data for session distribution (replaces pie chart)
  const sessionDistData = sessionDuration ? [
    { name: '<1 min', value: sessionDuration.distribution.under1min, color: '#E8887A' },
    { name: '1–3 min', value: sessionDuration.distribution.between1and3, color: '#E8B060' },
    { name: '3–10 min', value: sessionDuration.distribution.between3and10, color: '#8FBEEC' },
    { name: '10+ min', value: sessionDuration.distribution.over10min, color: '#A9E07C' },
  ] : []
  const sessionTotal = sessionDistData.reduce((s, d) => s + d.value, 0)

  // Flat bar data for devices (replaces pie chart)
  const deviceData = deviceBreakdown ? [
    { name: 'Mobile', value: deviceBreakdown.mobile, color: '#8FBEEC' },
    { name: 'Desktop', value: deviceBreakdown.desktop, color: '#A9E07C' },
    { name: 'Unknown', value: deviceBreakdown.unknown, color: '#9A9280' },
  ].filter(d => d.value > 0) : []
  const deviceTotal = deviceData.reduce((s, d) => s + d.value, 0)

  const cardStyle: React.CSSProperties = {
    background: 'var(--al-card)',
    border: '1px solid rgba(var(--al-line, 62,54,36), .09)',
    borderRadius: 14,
    padding: '22px 24px',
  }
  const h2Style: React.CSSProperties = {
    margin: '0 0 16px',
    fontFamily: 'var(--font-spectral, serif)', fontSize: 18, fontWeight: 600,
    lineHeight: 1.2, color: 'var(--al-ink2)',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 12, fontWeight: 400,
    color: 'var(--al-mut4)', lineHeight: 1,
  }
  const bigNumStyle: React.CSSProperties = {
    fontFamily: 'var(--font-spectral, serif)', fontSize: 30, fontWeight: 600,
    lineHeight: 1, color: 'var(--al-accent)',
  }
  const subStyle: React.CSSProperties = {
    fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 11.5, fontWeight: 400,
    color: 'var(--al-mut3)', marginTop: 3, lineHeight: 1,
  }
  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left',
    fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 11, fontWeight: 600,
    letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--al-mut4)',
    borderBottom: '1px solid rgba(var(--al-line, 62,54,36), .09)',
  }
  const tdStyle: React.CSSProperties = {
    padding: '10px 14px',
    fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 13, fontWeight: 400,
    color: 'var(--al-ink4)', lineHeight: 1,
    borderBottom: '1px solid rgba(var(--al-line, 62,54,36), .06)',
  }
  const tooltipStyle = {
    backgroundColor: 'var(--al-card)',
    border: '1px solid rgba(var(--al-line, 62,54,36), .18)',
    borderRadius: 10,
    fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 12,
    color: 'var(--al-ink3)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Date Range Filter */}
      <div style={{ display: 'flex', gap: 6 }}>
        {([7, 30, 90] as const).map((days) => (
          <button
            key={days}
            onClick={() => handleDateRangeChange(days)}
            disabled={isLoading}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 13, fontWeight: 500,
              lineHeight: 1, transition: 'all .13s ease', opacity: isLoading ? 0.5 : 1,
              background: dateRange === days ? 'var(--al-accent)' : 'rgba(var(--al-line, 62,54,36), .08)',
              color: dateRange === days ? 'var(--al-on-accent)' : 'var(--al-sub)',
            }}
          >
            {days === 7 ? 'Last 7 days' : days === 30 ? 'Last 30 days' : 'Last 90 days'}
          </button>
        ))}
      </div>

      {/* Overview Cards */}
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
          {[
            { label: 'Total Pageviews', value: overview.totalViews.toLocaleString(), sub: null },
            { label: 'Unique Visitors', value: overview.uniqueVisitors.toLocaleString(), sub: null },
            { label: 'Logged In', value: overview.loggedInViews.toLocaleString(), sub: overview.totalViews > 0 ? `${Math.round((overview.loggedInViews / overview.totalViews) * 100)}% of total` : '0%' },
            { label: 'Anonymous', value: overview.anonymousViews.toLocaleString(), sub: overview.totalViews > 0 ? `${Math.round((overview.anonymousViews / overview.totalViews) * 100)}% of total` : '0%' },
            { label: 'Saved Articles', value: savedArticlesStats ? savedArticlesStats.totalSaved.toLocaleString() : '—', sub: savedArticlesStats ? `${savedArticlesStats.uniqueUsers} users` : null },
            { label: `Synthesis Runs (${dateRange}d)`, value: String(synthesisStats?.totalRuns ?? 0), sub: synthesisStats && synthesisStats.totalRuns > 0 && synthesisStats.totalHelpful > 0 ? `${Math.round(synthesisStats.totalHelpful / synthesisStats.totalRuns * 100)}% helpful` : 'No feedback yet' },
          ].map((card, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ ...labelStyle, marginBottom: 10 }}>{card.label}</div>
              <div style={bigNumStyle}>{card.value}</div>
              {card.sub && <div style={subStyle}>{card.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Visitors Over Time */}
      {visitorsOverTime.length > 0 && (
        <div style={cardStyle}>
          <h2 style={h2Style}>Visitors over time</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={visitorsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--al-line,62,54,36),.12)" />
              <XAxis dataKey="date" stroke="var(--al-mut6)" tick={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11 }} />
              <YAxis stroke="var(--al-mut6)" tick={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 12 }} />
              <Line type="monotone" dataKey="totalViews" stroke="var(--al-accent)" strokeWidth={2} dot={false} name="Total Views" />
              <Line type="monotone" dataKey="uniqueVisitors" stroke="#8FBEEC" strokeWidth={2} dot={false} name="Unique Visitors" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Pages */}
      {topPages.length > 0 && (
        <div style={cardStyle}>
          <h2 style={h2Style}>Top pages</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topPages} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--al-line,62,54,36),.12)" />
              <XAxis type="number" stroke="var(--al-mut6)" tick={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11 }} />
              <YAxis dataKey="path" type="category" width={160} stroke="var(--al-mut6)" tick={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="views" fill="var(--al-accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Articles */}
      {topArticles.length > 0 && (
        <div style={cardStyle}>
          <h2 style={h2Style}>Top articles</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Title</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Views</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Unique</th>
              </tr>
            </thead>
            <tbody>
              {topArticles.map((article) => (
                <tr key={article.id}>
                  <td style={tdStyle}>
                    <a href={`/article/${article.id}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--al-ink3)', textDecoration: 'none' }}>
                      {article.title}
                    </a>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>{article.views}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--al-mut3)' }}>{article.uniqueVisitors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Session Duration + Distribution */}
      {sessionDuration && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={cardStyle}>
            <h2 style={h2Style}>Session duration</h2>
            <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
              <div>
                <div style={labelStyle}>Average</div>
                <div style={{ ...bigNumStyle, marginTop: 6 }}>{formatDuration(sessionDuration.average)}</div>
              </div>
              <div>
                <div style={labelStyle}>Median</div>
                <div style={{ ...bigNumStyle, marginTop: 6, color: '#8FBEEC' }}>{formatDuration(sessionDuration.median || 0)}</div>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11, fontStyle: 'italic', color: 'var(--al-mut6)' }}>
              Sessions capped at 30 min
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={h2Style}>Duration distribution</h2>
            {sessionTotal > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sessionDistData.map(d => {
                  const pct = sessionTotal > 0 ? Math.round((d.value / sessionTotal) * 100) : 0
                  return (
                    <div key={d.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 12, color: 'var(--al-sub)' }}>{d.name}</span>
                        <span style={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 12, fontWeight: 600, color: 'var(--al-ink3)' }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: 'rgba(var(--al-line,62,54,36),.08)' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: d.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ color: 'var(--al-mut4)', fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
                No session data yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Device Breakdown + Countries */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {deviceBreakdown && (
          <div style={cardStyle}>
            <h2 style={h2Style}>Device breakdown</h2>
            {deviceTotal > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {deviceData.map(d => {
                  const pct = Math.round((d.value / deviceTotal) * 100)
                  return (
                    <div key={d.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 12, color: 'var(--al-sub)' }}>{d.name}</span>
                        <span style={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 12, fontWeight: 600, color: 'var(--al-ink3)' }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: 'rgba(var(--al-line,62,54,36),.08)' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: d.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ color: 'var(--al-mut4)', fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
                No device data yet
              </div>
            )}
          </div>
        )}

        {topCountries && topCountries.length > 0 && (
          <div style={cardStyle}>
            <h2 style={h2Style}>Top countries</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {topCountries.map((country, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 0',
                  borderBottom: idx < topCountries.length - 1 ? '1px solid rgba(var(--al-line,62,54,36),.07)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{getCountryFlag(country.country)}</span>
                    <span style={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 13, color: 'var(--al-ink3)' }}>
                      {country.country}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <span style={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 13, fontWeight: 600, color: 'var(--al-ink3)' }}>
                      {country.views}
                    </span>
                    <span style={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 12, color: 'var(--al-mut4)' }}>
                      {country.uniqueVisitors} uniq
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Traffic Sources */}
      {trafficSources.length > 0 && (
        <div style={cardStyle}>
          <h2 style={h2Style}>Traffic sources</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trafficSources}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--al-line,62,54,36),.12)" />
              <XAxis dataKey="source" stroke="var(--al-mut6)" angle={-30} textAnchor="end" height={70} tick={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11 }} />
              <YAxis stroke="var(--al-mut6)" tick={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="visits" fill="var(--al-accent)" radius={[4, 4, 0, 0]} name="Visits" />
            </BarChart>
          </ResponsiveContainer>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
            <thead>
              <tr>
                <th style={thStyle}>Source</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Visits</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Unique</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Signups</th>
              </tr>
            </thead>
            <tbody>
              {trafficSources.map((source, idx) => (
                <tr key={idx}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{source.source}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{source.visits}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{source.uniqueVisitors}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{source.signups}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Searches */}
      <div style={cardStyle}>
        <h2 style={h2Style}>Recent searches</h2>
        {recentSearches.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <SortableHeader column="query" label="Query" />
                <SortableHeader column="count" label="Searches" />
                <SortableHeader column="avg_results" label="Avg. Results" />
                <SortableHeader column="last_searched" label="Last Searched" />
              </tr>
            </thead>
            <tbody>
              {sortedSearches.map((search, idx) => (
                <tr key={idx}>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{search.query}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{search.count}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{search.avgResults}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--al-mut3)' }}>{new Date(search.lastSearched).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--al-mut4)', fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 14 }}>
            No searches recorded yet
          </div>
        )}
      </div>
    </div>
  )
}
