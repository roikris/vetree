'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type FunnelRow = {
  id: string
  post_url: string | null
  post_date: string
  article_id: string | null
  article_title: string | null
  impressions: number
  engagements: number
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

type DryRunPreview = {
  sheets: Record<string, {
    headers: string[]
    detectedCols: Record<string, string | null>
    rows: Record<string, unknown>[]
  }>
}

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export function LinkedInPerformance() {
  const [rows, setRows] = useState<FunnelRow[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [funnelLoading, setFunnelLoading] = useState(false)
  const [funnelError, setFunnelError] = useState<string | null>(null)

  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<Record<string, unknown> | null>(null)
  const [dryPreview, setDryPreview] = useState<DryRunPreview | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
    setUploadResult(null)
    setUploadError(null)

    // Auto dry-run
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
      setDryPreview(data)
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
    setUploadResult(null)
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
      setUploadResult(data)
      setDryPreview(null)
      setPendingFile(null)
      if (fileRef.current) fileRef.current.value = ''
      // Reload funnel
      await loadFunnel()
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setUploadLoading(false)
    }
  }

  const th = { padding: '8px 12px', textAlign: 'left' as const, fontWeight: 600, fontSize: 12, color: '#888', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' as const }
  const td = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' as const }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Upload section */}
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
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600 }}>Preview — detected columns per sheet:</p>
            {Object.entries(dryPreview.sheets).map(([sheetName, sheet]) => (
              <div key={sheetName} style={{ marginBottom: 14, padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 13 }}>Sheet: {sheetName}</p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
                  {Object.entries(sheet.detectedCols).map(([key, col]) => (
                    <span key={key} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: col ? '#dcfce7' : '#fee2e2', color: col ? '#166534' : '#991b1b' }}>
                      {key}: {col || 'NOT FOUND'}
                    </span>
                  ))}
                </div>
                {sheet.rows.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr>
                          {Object.keys(sheet.rows[0]).slice(0, 8).map(h => (
                            <th key={h} style={{ ...th, fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.rows.map((row, i) => (
                          <tr key={i}>
                            {Object.values(row).slice(0, 8).map((v, j) => (
                              <td key={j} style={{ ...td, fontSize: 11 }}>{String(v ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
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
        {uploadResult && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, fontSize: 13, color: '#166534' }}>
            Imported successfully — {(uploadResult.upserted as number) + (uploadResult.inserted as number)} rows
            ({uploadResult.matched_articles as number} matched to articles).
            Date range: {(uploadResult.date_range as {from: string, to: string})?.from} → {(uploadResult.date_range as {from: string, to: string})?.to}
          </div>
        )}
      </div>

      {/* Funnel query section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>LinkedIn Funnel</h3>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5 }} placeholder="From" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5 }} placeholder="To" />
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
        </div>

        {funnelError && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, color: '#b91c1c', marginBottom: 12 }}>
            {funnelError}
          </div>
        )}

        {totals && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
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

        {rows.length > 0 && (
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Article</th>
                  <th style={th}>Impressions</th>
                  <th style={th}>Engagements</th>
                  <th style={th}>Sessions</th>
                  <th style={th}>Unique Visitors</th>
                  <th style={th}>Saves</th>
                  <th style={th}>CTR</th>
                  <th style={th}>Post</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} style={{ background: '#fff' }}>
                    <td style={td}>{row.post_date}</td>
                    <td style={{ ...td, maxWidth: 240 }}>
                      {row.article_id ? (
                        <a href={`/article/${row.article_id}`} target="_blank" rel="noreferrer"
                           style={{ color: '#3D7A5F', textDecoration: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {row.article_title || row.article_id}
                        </a>
                      ) : <span style={{ color: '#aaa' }}>—</span>}
                    </td>
                    <td style={td}>{row.impressions.toLocaleString()}</td>
                    <td style={td}>{row.engagements.toLocaleString()}</td>
                    <td style={td}>{row.sessions}</td>
                    <td style={td}>{row.unique_visitors}</td>
                    <td style={td}>{row.saves}</td>
                    <td style={{ ...td, fontWeight: row.ctr > 0 ? 600 : 400, color: row.ctr > 0.5 ? '#166534' : 'inherit' }}>
                      {row.ctr > 0 ? `${row.ctr}%` : '—'}
                    </td>
                    <td style={td}>
                      {row.post_url ? (
                        <a href={row.post_url} target="_blank" rel="noreferrer"
                           style={{ color: '#0077b5', fontSize: 12 }}>↗ LinkedIn</a>
                      ) : <span style={{ color: '#aaa' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!funnelLoading && rows.length === 0 && totals && (
          <p style={{ color: '#888', fontSize: 13 }}>No data in selected range. Upload an XLSX first.</p>
        )}
      </div>
    </div>
  )
}
