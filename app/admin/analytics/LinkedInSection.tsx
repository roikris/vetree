'use client'

import { useState, useEffect, useRef } from 'react'
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
  sample_posts: { url: string; post_date: string | null; engagements: number | null; impressions: number | null }[]
  sample_daily: { date: string; impressions: number | null; engagements: number | null; new_followers: number | null }[]
}

type ImportResult = {
  posts_upserted: number
  daily_rows_upserted: number
  total_followers: number | null
  total_followers_date: string | null
  matched_articles: number
  match_breakdown: { slug: number; date: number; haiku: number; activity_id: number; unmatched: number }
  demographics: unknown[][]
}

type ArticleHit = { id: string; title: string; labels: string[] | null }

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

export function LinkedInSection() {
  const [rows, setRows] = useState<FunnelRow[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [dailyTrend, setDailyTrend] = useState<DailyTrendRow[]>([])
  const [funnelLoading, setFunnelLoading] = useState(true)
  const [funnelError, setFunnelError] = useState<string | null>(null)

  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [dryPreview, setDryPreview] = useState<DryRunResult | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [rematchLoading, setRematchLoading] = useState(false)
  const [rematchResult, setRematchResult] = useState<{ updated: number; still_unmatched: number; breakdown: Record<string, number> } | null>(null)

  const [pickerRowId, setPickerRowId] = useState<string | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerResults, setPickerResults] = useState<ArticleHit[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)

  // Fetch on mount — navigating away and back shows the same data
  useEffect(() => {
    loadFunnel()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    color: 'var(--al-mut4)', borderBottom: '1px solid rgba(var(--al-line,62,54,36),.12)', whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    padding: '8px 12px', fontSize: 13, borderBottom: '1px solid rgba(var(--al-line,62,54,36),.07)', verticalAlign: 'top',
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--al-card)',
    border: '1px solid rgba(var(--al-line,62,54,36),.12)',
    borderRadius: 12,
    padding: 24,
    marginBottom: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{
        margin: 0,
        fontFamily: 'var(--font-spectral, serif)', fontSize: 20, fontWeight: 600,
        color: 'var(--al-ink2)', letterSpacing: '-.01em',
      }}>
        LinkedIn Performance
      </h2>

      {/* ── Upload ──────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14, color: 'var(--al-ink3)' }}>
          Import XLSX Export
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ fontSize: 13 }} />
          {uploadLoading && <span style={{ fontSize: 13, color: 'var(--al-mut4)' }}>Processing…</span>}
        </div>

        {uploadError && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, color: '#b91c1c' }}>
            {uploadError}
          </div>
        )}

        {dryPreview && (
          <div style={{ marginTop: 16 }}>
            <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 13, color: 'var(--al-ink2)' }}>
              Preview — sheets: <em>{dryPreview.sheets_found.join(', ')}</em>
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                { label: 'Posts', val: dryPreview.top_posts_count, ok: dryPreview.top_posts_header_found },
                { label: 'Daily rows', val: dryPreview.daily_rows_count, ok: dryPreview.daily_rows_count > 0 },
                { label: 'Follower rows', val: dryPreview.follower_rows, ok: dryPreview.follower_rows > 0 },
                ...(dryPreview.total_followers !== null ? [{ label: `Followers (${dryPreview.total_followers_date})`, val: dryPreview.total_followers, ok: true }] : []),
              ].map(({ label, val, ok }) => (
                <span key={label} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b' }}>
                  {label}: {val}
                </span>
              ))}
            </div>
            {dryPreview.sample_posts.length > 0 && (
              <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
                  <thead><tr>
                    {['Date', 'Impressions', 'Engagements', 'URL'].map(h => <th key={h} style={{ ...th, fontSize: 11 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>{dryPreview.sample_posts.map((p, i) => (
                    <tr key={i}>
                      <td style={{ ...td, fontSize: 11 }}>{p.post_date ?? '—'}</td>
                      <td style={{ ...td, fontSize: 11 }}>{p.impressions ?? '—'}</td>
                      <td style={{ ...td, fontSize: 11 }}>{p.engagements ?? '—'}</td>
                      <td style={{ ...td, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.url}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={uploadLoading}
              style={{
                padding: '8px 20px', background: 'var(--al-accent)', color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
                cursor: uploadLoading ? 'not-allowed' : 'pointer', opacity: uploadLoading ? 0.7 : 1,
              }}
            >
              {uploadLoading ? 'Importing…' : 'Confirm Import'}
            </button>
          </div>
        )}

        {importResult && (
          <div style={{ marginTop: 12, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
            <p style={{ margin: '0 0 8px', color: '#166534', fontWeight: 600, fontSize: 13 }}>Import complete</p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
              {[
                { label: 'Posts', val: importResult.posts_upserted },
                { label: 'Daily rows', val: importResult.daily_rows_upserted },
                { label: 'Matched', val: importResult.matched_articles },
                ...(importResult.total_followers !== null ? [{ label: `Followers (${importResult.total_followers_date})`, val: importResult.total_followers?.toLocaleString() }] : []),
              ].map(({ label, val }) => (
                <div key={label} style={{ fontSize: 12 }}><span style={{ color: '#888' }}>{label}: </span><strong>{val}</strong></div>
              ))}
            </div>
            {importResult.match_breakdown && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(importResult.match_breakdown).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 3,
                    background: k === 'activity_id' ? '#dbeafe' : k === 'slug' ? '#dcfce7' : k === 'date' ? '#e0e7ff' : k === 'haiku' ? '#f3e8ff' : '#fee2e2',
                    color: k === 'activity_id' ? '#1e40af' : k === 'slug' ? '#166534' : k === 'date' ? '#3730a3' : k === 'haiku' ? '#6b21a8' : '#991b1b' }}>
                    {k}: {v as number}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Funnel controls ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ fontSize: 13, padding: '5px 8px', border: '1px solid rgba(var(--al-line,62,54,36),.25)', borderRadius: 6, background: 'var(--al-card)', color: 'var(--al-ink2)' }} />
        <span style={{ fontSize: 13, color: 'var(--al-mut4)' }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ fontSize: 13, padding: '5px 8px', border: '1px solid rgba(var(--al-line,62,54,36),.25)', borderRadius: 6, background: 'var(--al-card)', color: 'var(--al-ink2)' }} />
        <button onClick={loadFunnel} disabled={funnelLoading}
          style={{ padding: '6px 16px', background: 'var(--al-accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: funnelLoading ? 'not-allowed' : 'pointer', opacity: funnelLoading ? 0.7 : 1 }}>
          {funnelLoading ? 'Loading…' : 'Refresh'}
        </button>
        <button onClick={handleRematch} disabled={rematchLoading}
          style={{ padding: '6px 14px', background: 'transparent', color: 'var(--al-accent)', border: '1px solid var(--al-accent)', borderRadius: 6, fontSize: 13, cursor: rematchLoading ? 'not-allowed' : 'pointer', opacity: rematchLoading ? 0.7 : 1 }}>
          {rematchLoading ? 'Re-matching…' : 'Re-match unmatched'}
        </button>
        {rematchResult && (
          <span style={{ fontSize: 12, color: 'var(--al-mut4)' }}>
            Updated {rematchResult.updated} — {rematchResult.still_unmatched} still unmatched
          </span>
        )}
      </div>

      {funnelError && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, color: '#b91c1c' }}>
          {funnelError}
        </div>
      )}

      {/* ── Stat cards ────────────────────────────────────────────────── */}
      {totals && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Impressions', value: totals.impressions.toLocaleString() },
            { label: 'Engagements', value: totals.engagements.toLocaleString() },
            { label: 'Sessions', value: totals.sessions.toLocaleString() },
            { label: 'Unique visitors', value: totals.unique_visitors.toLocaleString() },
            { label: 'Saves', value: totals.saves.toLocaleString() },
            { label: 'CTR', value: `${totals.ctr}%` },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--al-card2)', border: '1px solid rgba(var(--al-line,62,54,36),.12)', borderRadius: 8, padding: '10px 16px', minWidth: 100 }}>
              <div style={{ fontSize: 11, color: 'var(--al-mut4)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--al-ink2)' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Daily trend chart ─────────────────────────────────────────── */}
      {dailyTrend.length > 0 && (
        <div style={sectionStyle}>
          <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 13, color: 'var(--al-ink3)' }}>
            Daily impressions &amp; new followers
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--al-line,62,54,36),.12)" />
              <XAxis dataKey="metric_date" stroke="var(--al-mut6)"
                tick={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11 }}
                tickFormatter={d => d.slice(5)} />
              <YAxis yAxisId="left" stroke="var(--al-mut6)" tick={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" stroke="var(--al-mut6)" tick={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontFamily: 'var(--font-instrument,sans-serif)', fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="var(--al-accent)" strokeWidth={2} dot={false} name="Impressions" connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="new_followers" stroke="#8FBEEC" strokeWidth={2} dot={false} name="New followers" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Per-post table ────────────────────────────────────────────── */}
      {funnelLoading && !rows.length && (
        <div style={{ color: 'var(--al-mut4)', fontSize: 13, padding: 16 }}>Loading…</div>
      )}
      {!funnelLoading && !rows.length && (
        <div style={{ color: 'var(--al-mut4)', fontSize: 13, padding: 16 }}>
          No data yet. Import an XLSX export above.
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid rgba(var(--al-line,62,54,36),.12)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'var(--al-card)' }}>
            <thead style={{ background: 'var(--al-card2)' }}>
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
                <tr key={row.id} style={{ background: row.article_id ? 'transparent' : 'rgba(251,191,36,.05)' }}>
                  <td style={td}>{row.post_date}</td>
                  <td style={{ ...td, maxWidth: 220 }}>
                    {row.article_id ? (
                      <a href={`/article/${row.article_id}`} target="_blank" rel="noreferrer"
                        style={{ color: 'var(--al-accent)', textDecoration: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12 }}>
                        {row.article_title || row.article_id}
                      </a>
                    ) : (
                      pickerRowId === row.id ? (
                        <div style={{ position: 'relative' }}>
                          <input autoFocus value={pickerQuery} onChange={e => handlePickerSearch(e.target.value)}
                            placeholder="Search articles…"
                            style={{ width: '100%', fontSize: 12, padding: '4px 6px', border: '1px solid rgba(var(--al-line,62,54,36),.25)', borderRadius: 4, background: 'var(--al-card)', color: 'var(--al-ink2)' }} />
                          {pickerLoading && <div style={{ fontSize: 11, color: 'var(--al-mut4)', marginTop: 2 }}>Searching…</div>}
                          {pickerResults.length > 0 && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--al-card)', border: '1px solid rgba(var(--al-line,62,54,36),.18)', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
                              {pickerResults.map(a => (
                                <button key={a.id} onClick={() => handleManualAssign(row.id, a.id)}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, background: 'none', border: 'none', borderBottom: '1px solid rgba(var(--al-line,62,54,36),.07)', cursor: 'pointer', color: 'var(--al-ink2)' }}>
                                  {a.title}
                                </button>
                              ))}
                            </div>
                          )}
                          <button onClick={() => { setPickerRowId(null); setPickerQuery(''); setPickerResults([]) }}
                            style={{ marginTop: 4, fontSize: 11, color: 'var(--al-mut4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setPickerRowId(row.id); setPickerQuery(''); setPickerResults([]) }}
                          style={{ fontSize: 11, color: '#0077b5', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                          + assign article
                        </button>
                      )
                    )}
                  </td>
                  <td style={{ ...td, maxWidth: 160 }}>
                    {row.article_labels?.slice(0, 3).map(l => (
                      <span key={l} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(var(--al-acct),.08)', color: 'var(--al-accent)', marginRight: 3, display: 'inline-block', marginBottom: 2 }}>{l}</span>
                    ))}
                  </td>
                  <td style={td}>
                    {row.match_method ? (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3,
                        background: row.match_method === 'activity_id' ? '#dbeafe' : row.match_method === 'slug' ? '#dcfce7' : row.match_method === 'date' ? '#e0e7ff' : row.match_method === 'haiku' ? '#f3e8ff' : '#fef9c3',
                        color: row.match_method === 'activity_id' ? '#1e40af' : row.match_method === 'slug' ? '#166534' : row.match_method === 'date' ? '#3730a3' : row.match_method === 'haiku' ? '#6b21a8' : '#854d0e' }}>
                        {row.match_method}
                      </span>
                    ) : <span style={{ color: 'var(--al-mut6)', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={td}>{row.impressions?.toLocaleString() ?? '—'}</td>
                  <td style={td}>{row.engagements?.toLocaleString() ?? '—'}</td>
                  <td style={td}>{row.sessions}</td>
                  <td style={td}>{row.saves}</td>
                  <td style={{ ...td, fontWeight: row.ctr > 0 ? 600 : 400, color: row.ctr > 0.5 ? '#166534' : 'inherit' }}>
                    {row.ctr > 0 ? `${row.ctr}%` : '—'}
                  </td>
                  <td style={td}>
                    {row.post_url
                      ? <a href={row.post_url} target="_blank" rel="noreferrer" style={{ color: '#0077b5', fontSize: 12 }}>↗</a>
                      : <span style={{ color: 'var(--al-mut6)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
