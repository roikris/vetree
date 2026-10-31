'use client'

// Admin → Analytics → Google Search (analytics-001, migration 088): Search Console's own figures from the daily import,
// next to what our page_views saw for the same pages. Its own 7 / 28 / 90-day selector (Search Console days are Pacific
// time and lag 2–3 days, so it can't share the page's range).
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Metrics = { clicks: number; impressions: number; ctr: number | null; position: number | null }
type Page = Metrics & {
  page_url: string; host: string; path: string; title: string | null
  local: { googleViews: number; medianSeconds: number | null; unmeasured: number } | null
  article: { id: string; lastPost: string | null } | null
}
type Data =
  | { empty: true }
  | {
      empty: false; days: number; from: string; to: string
      daily: (Metrics & { day: string })[]
      totals: { clicks: number; impressions: number; position: number | null }
      queries: (Metrics & { query: string })[]
      pages: Page[]
      incomplete_days: { day: string; status: string; query_truncated: boolean; page_truncated: boolean }[]
    }

const RANGES = [7, 28, 90] as const
const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const pos = (v: number | null) => (v == null ? '—' : v.toFixed(1))
const num = (v: number) => v.toLocaleString('en-US')

const tooltipStyle = {
  backgroundColor: 'var(--al-card)', border: '1px solid rgba(var(--al-line, 62,54,36), .18)', borderRadius: 10,
  fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 12, color: 'var(--al-ink3)',
}
const sectionStyle: React.CSSProperties = {
  background: 'var(--al-card)', border: '1px solid rgba(var(--al-line,62,54,36),.12)', borderRadius: 12, padding: 24,
}
const th: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--al-mut4)',
  borderBottom: '1px solid rgba(var(--al-line,62,54,36),.12)', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '8px 12px', fontSize: 13, borderBottom: '1px solid rgba(var(--al-line,62,54,36),.07)', verticalAlign: 'top',
}
const note: React.CSSProperties = { margin: '8px 0 0', fontSize: 12, color: 'var(--al-mut4)', lineHeight: 1.5 }
const h3: React.CSSProperties = { margin: '0 0 12px', fontWeight: 600, fontSize: 14, color: 'var(--al-ink3)' }

const STATUS_LABEL: Record<string, string> = {
  missing: 'not imported', failed: 'import failed (retried daily)', expired: 'beyond Google’s 16 months',
  preliminary: 'preliminary or re-import pending', ok: 'hit Google’s row limit',
}

export function GoogleSearchSection() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(28)
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/analytics/search-console?days=${days}`)
      .then(async res => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Admins only' : 'Could not load Search Console data')
        return res.json() as Promise<Data>
      })
      .then(d => { if (!cancelled) { setData(d); setError(null) } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load Search Console data') })
    return () => { cancelled = true }
  }, [days])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-spectral, serif)', fontSize: 20, fontWeight: 600, color: 'var(--al-ink2)', letterSpacing: '-.01em' }}>
          Google Search
        </h2>
        <div role="group" aria-label="Search Console range" style={{ display: 'flex', gap: 6 }}>
          {RANGES.map(r => (
            <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)} style={{
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
              border: '1px solid rgba(var(--al-line,62,54,36),.18)',
              background: days === r ? 'var(--al-accent)' : 'var(--al-card)', color: days === r ? 'var(--al-onaccent)' : 'var(--al-ink3)',
            }}>{r} days</button>
          ))}
        </div>
      </div>

      {error && <div style={{ ...sectionStyle, color: 'var(--al-ink3)' }}>{error}</div>}
      {!error && !data && <div style={{ ...sectionStyle, color: 'var(--al-mut4)' }}>Loading…</div>}
      {!error && data?.empty && (
        <div style={{ ...sectionStyle, color: 'var(--al-mut4)' }}>
          No successful Search Console import yet — see the GitHub Action “Search Console Import” (a failed run is retried daily).
        </div>
      )}
      {!error && data && !data.empty && <Report data={data} />}
    </div>
  )
}

function Report({ data }: { data: Extract<Data, { empty: false }> }) {
  const ctr = data.totals.impressions ? data.totals.clicks / data.totals.impressions : null
  const tiles = [
    ['Impressions', num(data.totals.impressions)],
    ['Clicks', num(data.totals.clicks)],
    ['CTR', pct(ctr)],
    ['Avg position', pos(data.totals.position)],
  ]
  return (
    <>
      <div style={sectionStyle}>
        <p style={{ ...note, margin: 0 }}>
          {data.from} → {data.to} (Pacific time, as Google reports it; Search Console runs 2–3 days behind).
        </p>
        {data.incomplete_days.length > 0 && (
          <ul style={{ ...note, paddingLeft: 18, color: 'var(--al-ink3)' }}>
            {data.incomplete_days.map(d => (
              <li key={d.day}>
                {d.day}: {STATUS_LABEL[d.status] ?? d.status}
                {d.status !== 'ok' && (d.query_truncated || d.page_truncated) ? ', hit Google’s row limit' : ''}
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
          {tiles.map(([label, value]) => (
            <div key={label} style={{ background: 'var(--al-card2)', border: '1px solid rgba(var(--al-line,62,54,36),.12)', borderRadius: 8, padding: '10px 16px', minWidth: 110 }}>
              <div style={{ fontSize: 12, color: 'var(--al-mut4)' }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--al-ink2)' }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ width: '100%', height: 260, marginTop: 20 }}>
          <ResponsiveContainer>
            <LineChart data={data.daily} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--al-line,62,54,36),.12)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis yAxisId="i" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="c" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="i" type="monotone" dataKey="impressions" name="Impressions" stroke="var(--al-accent)" dot={false} strokeWidth={2} />
              <Line yAxisId="c" type="monotone" dataKey="clicks" name="Clicks" stroke="#d97706" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p style={note}>Site totals, as in Search Console’s Performance report.</p>
      </div>

      <div style={sectionStyle}>
        <h3 style={h3}>Top searches</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Query', 'Impressions', 'Clicks', 'CTR', 'Position'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.queries.map(q => (
                <tr key={q.query}>
                  <td style={td}>{q.query}</td><td style={td}>{num(q.impressions)}</td><td style={td}>{num(q.clicks)}</td>
                  <td style={td}>{pct(q.ctr)}</td><td style={td}>{pos(q.position)}</td>
                </tr>
              ))}
              {!data.queries.length && <tr><td style={td} colSpan={5}>No queries in this range.</td></tr>}
            </tbody>
          </table>
        </div>
        <p style={note}>The top queries Google provides. Rare searches are withheld by Google for privacy, so these add up to less than the site totals.</p>
      </div>

      <div style={sectionStyle}>
        <h3 style={h3}>Top pages</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Page', 'Impressions', 'Clicks', 'CTR', 'Position', 'Our visits from Google', 'Median visible time', 'Last Growth OS post'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.pages.map(p => (
                <tr key={p.page_url}>
                  <td style={{ ...td, maxWidth: 360 }}>
                    <a href={p.page_url} target="_blank" rel="noreferrer" style={{ color: 'var(--al-accent)' }}>{p.title ?? `${p.host}${p.path}`}</a>
                    {p.title && <div style={{ fontSize: 11, color: 'var(--al-mut4)' }}>{p.path}</div>}
                  </td>
                  <td style={td}>{num(p.impressions)}</td><td style={td}>{num(p.clicks)}</td>
                  <td style={td}>{pct(p.ctr)}</td><td style={td}>{pos(p.position)}</td>
                  <td style={td}>{p.local ? num(p.local.googleViews) : '—'}</td>
                  <td style={td}>
                    {p.local?.medianSeconds != null ? `${Math.round(p.local.medianSeconds)} s` : '—'}
                    {p.local && p.local.unmeasured > 0 && <div style={{ fontSize: 11, color: 'var(--al-mut4)' }}>{p.local.unmeasured} not measured</div>}
                  </td>
                  <td style={td}>
                    {p.article ? (p.article.lastPost ? p.article.lastPost.slice(0, 10)
                      : <span style={{ color: '#b45309', fontWeight: 600 }}>No recorded post</span>) : '—'}
                  </td>
                </tr>
              ))}
              {!data.pages.length && <tr><td style={td} colSpan={8}>No pages in this range.</td></tr>}
            </tbody>
          </table>
        </div>
        <p style={note}>
          Per page: a search that showed two of our pages counts for each, so these don’t add up to the site totals.
          “Our visits from Google” are human page views on vetree.app with a Google referrer over the same dates
          (approximate: UTC vs Pacific), and can include later pages of the same visit. “Last Growth OS post” only knows
          posts marked in Growth OS.
        </p>
      </div>
    </>
  )
}
