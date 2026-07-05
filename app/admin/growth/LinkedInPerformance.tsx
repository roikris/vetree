'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'

type FunnelRow = {
  id: string
  post_url: string | null
  post_date: string
  article_id: string | null
  article_title: string | null
  article_labels: string[]
  match_method: string | null
  impressions: number | null
  engagements: number | null
  sessions: number
  unique_visitors: number
  saves: number
  ctr: number
}

type Totals = {
  impressions: number
  engagements: number
  sessions: number
  unique_visitors: number
  saves: number
  ctr: number
}

type DailyTrendRow = {
  metric_date: string
  impressions: number | null
  new_followers: number | null
}

type ImportResult = {
  posts_upserted: number
  daily_rows_upserted: number
  total_followers: number | null
  total_followers_date: string | null
  matched_articles: number
  match_breakdown: { slug: number; date: number; haiku: number; unmatched: number }
  discovery: unknown[][]
  demographics: unknown[][]
}

type ArticleHit = { id: string; title: string; labels: string[] | null }

type DryRunResult = {
  dry_run: true
  sheets_found: string[]
  top_posts_count: number
  top_posts_header_found: boolean
  daily_rows_count: number
  engagement_rows: number
  follower_rows: number
  total_followers: number | null
  total_followers_date: string | null
  discovery: unknown[][]
  demographics: unknown[][]
  sample_posts: {
    url: string
    post_date: string | null
    engagements: number | null
    impressions: number | null
  }[]
  sample_daily: {
    date: string
    impressions: number | null
    engagements: number | null
    new_followers: number | null
  }[]
}

const tooltipStyle = {
  backgroundColor: 'var(--al-card)',
  border: '1px solid rgba(var(--al-line, 62,54,36), .18)',
  borderRadius: 10,
  fontFamily: 'var(--font-instrument, sans-serif)',
  fontSize: 12,
  color: 'var(--al-ink3)',
}

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export function LinkedInPerformance() {
  const [rows, setRows] = useState<FunnelRow[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [dailyTrend, setDailyTrend] = useState<DailyTrendRow[]>([])
  const [funnelLoading, setFunnelLoading] = useState(false)
  const [funnelError, setFunnelError] = useState<string | null>(null)

  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [dryPreview, setDryPreview] = useState<DryRunResult | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Re-match state
  const [rematchLoading, setRematchLoading] = useState(false)
  const [rematchResult, setRematchResult] = useState<{ updated: number; still_unmatched: number; breakdown: Record<string, number> } | null>(null)

  // Article picker state per row
  const [pickerRowId, setPickerRowId] = useState<string | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerResults, setPickerResults] = useState<ArticleHit[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)

  const loadFunnel = async () => {
    setFunnelLoading(true)
    setFunnelError(null)
    try {
      const token = await getToken()
      const params = new URLSearchParams()
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      const res = await fetch(`/api/admin/linkedin-metrics/funnel?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load funnel')
      setRows(data.rows || [])
      setTotals(data.totals || null)
      setDailyTrend(data.daily_trend || [])
    } catch (e: unknown) {
      setFunnelError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setFunnelLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setDryPreview(null)
    setImportResult(null)
    setUploadError(null)

    setUploadLoading(true)
    try {
      const token = await getToken()
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/linkedin-metrics/upload?dry_run=true', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Dry run failed')
      setDryPreview(data as DryRunResult)
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setUploadLoading(false)
    }
  }

  const handleImport = async () => {
    if (!pendingFile) return
    setUploadLoading(true)
    setUploadError(null)
    setImportResult(null)
    try {
      const token = await getToken()
      const form = new FormData()
      form.append('file', pendingFile)
      const res = await fetch('/api/admin/linkedin-metrics/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setImportResult(data as ImportResult)
      setDryPreview(null)
      setPendingFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await loadFunnel()
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setUploadLoading(false)
    }
  }

  const handleRematch = async () => {
    setRematchLoading(true)
    setRematchResult(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/linkedin-metrics/rematch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Rematch failed')
      setRematchResult(data)
      await loadFunnel()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Rematch failed')
    } finally {
      setRematchLoading(false)
    }
  }

  const handlePickerSearch = async (q: string) => {
    setPickerQuery(q)
    if (q.length < 3) { setPickerResults([]); return }
    setPickerLoading(true)
    try {
      const res = await fetch(`/api/articles/search-quick?q=${encodeURIComponent(q)}&limit=6`)
      const data = await res.json()
      setPickerResults(data.articles ?? [])
    } finally {
      setPickerLoading(false)
    }
  }

  const handleManualAssign = async (rowId: string, articleId: string) => {
    const token = await getToken()
    await fetch(`/api/admin/linkedin-metrics/${rowId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: articleId }),
    })
    setPickerRowId(null)
    setPickerQuery('')
    setPickerResults([])
    await loadFunnel()
  }

  const th: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12,
    color: '#888', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    padding: '8px 12px', fontSize: 13, borderBottom: '1px solid #f3f4f6', verticalAlign: 'top',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Upload ──────────────────────────────────────────────────────── */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 15 }}>Import LinkedIn XLSX Export</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={{ fontSize: 13 }}
          />
          {uploadLoading && <span style={{ fontSize: 13, color: '#888' }}>Processing…</span>}
        </div>

        {uploadError && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, color: '#b91c1c' }}>
            {uploadError}
          </div>
        )}

        {/* Dry-run preview */}
        {dryPreview && (
          <div style={{ marginTop: 16 }}>
            <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 13 }}>
              Dry run — detected in <strong>{dryPreview.sheets_found.join(', ')}</strong>:
            </p>

            {/* Summary chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                { label: 'Posts', val: dryPreview.top_posts_count, ok: dryPreview.top_posts_header_found },
                { label: 'Daily rows', val: dryPreview.daily_rows_count, ok: dryPreview.daily_rows_count > 0 },
                { label: 'Engagement rows', val: dryPreview.engagement_rows, ok: dryPreview.engagement_rows > 0 },
                { label: 'Follower rows', val: dryPreview.follower_rows, ok: dryPreview.follower_rows > 0 },
              ].map(({ label, val, ok }) => (
                <span key={label} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b' }}>
                  {label}: {val}
                </span>
              ))}
              {dryPreview.total_followers !== null && (
                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, background: '#dbeafe', color: '#1e40af' }}>
                  Total followers: {dryPreview.total_followers.toLocaleString()} (as of {dryPreview.total_followers_date})
                </span>
              )}
            </div>

            {/* Sample posts */}
            {dryPreview.sample_posts.length > 0 && (
              <div style={{ marginBottom: 12, overflowX: 'auto' }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: '#888' }}>Sample posts (first 5):</p>
                <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      {['Date', 'Impressions', 'Engagements', 'Post URL'].map(h => (
                        <th key={h} style={{ ...th, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dryPreview.sample_posts.map((p, i) => (
                      <tr key={i}>
                        <td style={{ ...td, fontSize: 11 }}>{p.post_date ?? '—'}</td>
                        <td style={{ ...td, fontSize: 11 }}>{p.impressions ?? '—'}</td>
                        <td style={{ ...td, fontSize: 11 }}>{p.engagements ?? '—'}</td>
                        <td style={{ ...td, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.url}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sample daily */}
            {dryPreview.sample_daily.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: '#888' }}>Sample daily rows (first 5):</p>
                <table style={{ fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Date', 'Impressions', 'Engagements', 'New followers'].map(h => (
                        <th key={h} style={{ ...th, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dryPreview.sample_daily.map((d, i) => (
                      <tr key={i}>
                        <td style={{ ...td, fontSize: 11 }}>{d.date}</td>
                        <td style={{ ...td, fontSize: 11 }}>{d.impressions ?? '—'}</td>
                        <td style={{ ...td, fontSize: 11 }}>{d.engagements ?? '—'}</td>
                        <td style={{ ...td, fontSize: 11 }}>{d.new_followers ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={uploadLoading}
              style={{
                padding: '8px 20px', background: '#3D7A5F', color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
                cursor: uploadLoading ? 'not-allowed' : 'pointer', opacity: uploadLoading ? 0.7 : 1,
              }}
            >
              {uploadLoading ? 'Importing…' : 'Confirm Import'}
            </button>
          </div>
        )}

        {/* Import result */}
        {importResult && (
          <div style={{ marginTop: 12, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 13 }}>
            <p style={{ margin: '0 0 8px', color: '#166534', fontWeight: 600 }}>Import complete</p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
              {[
                { label: 'Posts imported/updated', val: importResult.posts_upserted },
                { label: 'Daily rows imported', val: importResult.daily_rows_upserted },
                { label: 'Matched to articles', val: importResult.matched_articles },
                ...(importResult.total_followers !== null ? [{ label: `Total followers (${importResult.total_followers_date})`, val: importResult.total_followers.toLocaleString() }] : []),
              ].map(({ label, val }) => (
                <div key={label} style={{ fontSize: 12 }}>
                  <span style={{ color: '#888' }}>{label}: </span>
                  <strong>{val}</strong>
                </div>
              ))}
            </div>
            {importResult.match_breakdown && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: importResult.demographics.length ? 12 : 0 }}>
                {[
                  { label: 'slug match', val: importResult.match_breakdown.slug, color: '#166534', bg: '#dcfce7' },
                  { label: 'date match', val: importResult.match_breakdown.date, color: '#1e40af', bg: '#dbeafe' },
                  { label: 'haiku match', val: importResult.match_breakdown.haiku, color: '#6b21a8', bg: '#f3e8ff' },
                  { label: 'unmatched', val: importResult.match_breakdown.unmatched, color: '#991b1b', bg: '#fee2e2' },
                ].map(({ label, val, color, bg }) => (
                  <span key={label} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: bg, color }}>
                    {label}: {val}
                  </span>
                ))}
              </div>
            )}

            {/* Demographics summary */}
            {importResult.demographics.length > 1 && (
              <div style={{ marginTop: 10 }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#555' }}>Top demographics:</p>
                <table style={{ fontSize: 11, borderCollapse: 'collapse' }}>
                  <tbody>
                    {importResult.demographics.slice(0, 8).map((row, i) => (
                      <tr key={i}>
                        {(row as unknown[]).slice(0, 3).map((cell, j) => (
                          <td key={j} style={{ padding: '2px 10px 2px 0', color: i === 0 ? '#888' : '#333' }}>
                            {String(cell ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Funnel ──────────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>LinkedIn Funnel</h3>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5 }} />
          <span style={{ fontSize: 13, color: '#888' }}>to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5 }} />
          <button
            onClick={loadFunnel}
            disabled={funnelLoading}
            style={{
              padding: '6px 16px', background: '#3D7A5F', color: '#fff',
              border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600,
              cursor: funnelLoading ? 'not-allowed' : 'pointer', opacity: funnelLoading ? 0.7 : 1,
            }}
          >
            {funnelLoading ? 'Loading…' : 'Load'}
          </button>
          <button
            onClick={handleRematch}
            disabled={rematchLoading}
            style={{
              padding: '6px 14px', background: 'transparent', color: '#3D7A5F',
              border: '1px solid #3D7A5F', borderRadius: 5, fontSize: 13, fontWeight: 500,
              cursor: rematchLoading ? 'not-allowed' : 'pointer', opacity: rematchLoading ? 0.7 : 1,
            }}
          >
            {rematchLoading ? 'Re-matching…' : 'Re-match unmatched posts'}
          </button>
          {rematchResult && (
            <span style={{ fontSize: 12, color: '#555' }}>
              Updated {rematchResult.updated} rows
              (slug: {rematchResult.breakdown.slug}, date: {rematchResult.breakdown.date}, haiku: {rematchResult.breakdown.haiku})
              — {rematchResult.still_unmatched} still unmatched
            </span>
          )}
        </div>

        {funnelError && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, color: '#b91c1c', marginBottom: 12 }}>
            {funnelError}
          </div>
        )}

        {/* Totals */}
        {totals && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Impressions', value: totals.impressions.toLocaleString() },
              { label: 'Engagements', value: totals.engagements.toLocaleString() },
              { label: 'Sessions', value: totals.sessions.toLocaleString() },
              { label: 'Unique Visitors', value: totals.unique_visitors.toLocaleString() },
              { label: 'Saves', value: totals.saves.toLocaleString() },
              { label: 'CTR', value: `${totals.ctr}%` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', minWidth: 100 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Daily trend chart */}
        {dailyTrend.length > 0 && (
          <div style={{ marginBottom: 24, background: 'var(--al-card)', border: '1px solid rgba(var(--al-line,62,54,36),.12)', borderRadius: 10, padding: '16px 20px' }}>
            <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 13 }}>Daily Impressions &amp; New Followers</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--al-line,62,54,36),.12)" />
                <XAxis
                  dataKey="metric_date"
                  stroke="var(--al-mut6)"
                  tick={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11 }}
                  tickFormatter={d => d.slice(5)} // MM-DD
                />
                <YAxis
                  yAxisId="left"
                  stroke="var(--al-mut6)"
                  tick={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="var(--al-mut6)"
                  tick={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  wrapperStyle={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 12 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="impressions"
                  stroke="var(--al-accent)"
                  strokeWidth={2}
                  dot={false}
                  name="Impressions"
                  connectNulls
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="new_followers"
                  stroke="#8FBEEC"
                  strokeWidth={2}
                  dot={false}
                  name="New followers"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-post table */}
        {rows.length > 0 && (
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Article</th>
                  <th style={th}>Labels</th>
                  <th style={th}>Match</th>
                  <th style={th}>Impressions</th>
                  <th style={th}>Engagements</th>
                  <th style={th}>Sessions</th>
                  <th style={th}>Saves</th>
                  <th style={th}>CTR</th>
                  <th style={th}>Post</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} style={{ background: row.article_id ? '#fff' : '#fffbf5' }}>
                    <td style={td}>{row.post_date}</td>
                    <td style={{ ...td, maxWidth: 220 }}>
                      {row.article_id ? (
                        <a href={`/article/${row.article_id}`} target="_blank" rel="noreferrer"
                          style={{ color: '#3D7A5F', textDecoration: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12 }}>
                          {row.article_title || row.article_id}
                        </a>
                      ) : (
                        <div>
                          {pickerRowId === row.id ? (
                            <div style={{ position: 'relative' }}>
                              <input
                                autoFocus
                                value={pickerQuery}
                                onChange={e => handlePickerSearch(e.target.value)}
                                placeholder="Search articles…"
                                style={{ width: '100%', fontSize: 12, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
                              />
                              {pickerLoading && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Searching…</div>}
                              {pickerResults.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
                                  {pickerResults.map(a => (
                                    <button
                                      key={a.id}
                                      onClick={() => handleManualAssign(row.id, a.id)}
                                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                                    >
                                      {a.title}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <button onClick={() => { setPickerRowId(null); setPickerQuery(''); setPickerResults([]) }}
                                style={{ marginTop: 4, fontSize: 11, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setPickerRowId(row.id); setPickerQuery(''); setPickerResults([]) }}
                              style={{ fontSize: 11, color: '#0077b5', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                            >
                              + assign article
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, maxWidth: 160 }}>
                      {row.article_labels.slice(0, 3).map(l => (
                        <span key={l} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#f0fdf4', color: '#166534', marginRight: 3, display: 'inline-block', marginBottom: 2 }}>
                          {l}
                        </span>
                      ))}
                    </td>
                    <td style={td}>
                      {row.match_method ? (
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 3,
                          background: row.match_method === 'slug' ? '#dcfce7' : row.match_method === 'date' ? '#dbeafe' : row.match_method === 'haiku' ? '#f3e8ff' : '#fef9c3',
                          color: row.match_method === 'slug' ? '#166534' : row.match_method === 'date' ? '#1e40af' : row.match_method === 'haiku' ? '#6b21a8' : '#854d0e',
                        }}>
                          {row.match_method}
                        </span>
                      ) : <span style={{ color: '#aaa', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={td}>{row.impressions?.toLocaleString() ?? '—'}</td>
                    <td style={td}>{row.engagements?.toLocaleString() ?? '—'}</td>
                    <td style={td}>{row.sessions}</td>
                    <td style={td}>{row.saves}</td>
                    <td style={{ ...td, fontWeight: row.ctr > 0 ? 600 : 400, color: row.ctr > 0.5 ? '#166534' : 'inherit' }}>
                      {row.ctr > 0 ? `${row.ctr}%` : '—'}
                    </td>
                    <td style={td}>
                      {row.post_url ? (
                        <a href={row.post_url} target="_blank" rel="noreferrer"
                          style={{ color: '#0077b5', fontSize: 12 }}>↗</a>
                      ) : <span style={{ color: '#aaa' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!funnelLoading && rows.length === 0 && totals && (
          <p style={{ color: '#888', fontSize: 13 }}>No post data in selected range. Upload an XLSX first.</p>
        )}
      </div>
    </div>
  )
}
