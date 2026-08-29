'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type CampaignRow = {
  utm_source: string
  utm_campaign: string
  utm_id: string
  visits: number
  unique_visitors: number
}

type DailyRow = { date: string; visits: number }
type Totals = { visits: number; unique_visitors: number }

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

const todayISO = () => new Date().toISOString().slice(0, 10)
const daysAgoISO = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10)

export function PaidCampaigns() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyRow[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(daysAgoISO(7))
  const [dateTo, setDateTo] = useState(todayISO())

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const params = new URLSearchParams()
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      const res = await fetch(`/api/admin/analytics/paid-campaigns?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load paid campaign data')
      setCampaigns(data.campaigns || [])
      setDailyTrend(data.daily_trend || [])
      setTotals(data.totals || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount — navigating away and back shows the same data
  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{
        margin: 0,
        fontFamily: 'var(--font-spectral, serif)', fontSize: 20, fontWeight: 600,
        color: 'var(--al-ink2)', letterSpacing: '-.01em',
      }}>
        Paid Campaigns
      </h2>
      <p style={{ margin: '-12px 0 0', fontSize: 13, color: 'var(--al-mut4)' }}>
        Traffic with <code>utm_medium=paid-social</code> — kept separate from organic social
        (<code>utm_medium=social</code>) even when they share the same <code>utm_source</code>
        (e.g. a LinkedIn ad vs. a LinkedIn post).
      </p>

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ fontSize: 13, padding: '5px 8px', border: '1px solid rgba(var(--al-line,62,54,36),.25)', borderRadius: 6, background: 'var(--al-card)', color: 'var(--al-ink2)' }} />
        <span style={{ fontSize: 13, color: 'var(--al-mut4)' }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ fontSize: 13, padding: '5px 8px', border: '1px solid rgba(var(--al-line,62,54,36),.25)', borderRadius: 6, background: 'var(--al-card)', color: 'var(--al-ink2)' }} />
        <button onClick={load} disabled={loading}
          style={{ padding: '6px 16px', background: 'var(--al-accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* ── Totals ──────────────────────────────────────────────────────── */}
      {totals && (
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--al-mut4)' }}>Visits</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--al-ink2)' }}>{totals.visits.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--al-mut4)' }}>Unique visitors</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--al-ink2)' }}>{totals.unique_visitors.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* ── Daily trend ─────────────────────────────────────────────────── */}
      {dailyTrend.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14, color: 'var(--al-ink3)' }}>
            Visits per day
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--al-line,62,54,36),.12)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="visits" stroke="var(--al-accent)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Campaign breakdown ──────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14, color: 'var(--al-ink3)' }}>
          By campaign / ad set
        </h3>
        {campaigns.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--al-mut4)' }}>
            No paid traffic in this date range yet.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ fontSize: 13, borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={th}>Source</th>
                  <th style={th}>Campaign</th>
                  <th style={th}>Ad set (utm_id)</th>
                  <th style={th}>Visits</th>
                  <th style={th}>Unique visitors</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={i}>
                    <td style={td}>{c.utm_source}</td>
                    <td style={td}>{c.utm_campaign}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{c.utm_id}</td>
                    <td style={td}>{c.visits.toLocaleString()}</td>
                    <td style={td}>{c.unique_visitors.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
