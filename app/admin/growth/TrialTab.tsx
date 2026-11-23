'use client'

// Growth OS → 🧪 December Trial (growth-005, Roi 2026-11-23): the December 2026 posting trial. Three parts:
// - the daily panel in trial mode (DailyPosts mode="trial"), until the trial ends;
// - "To record": per LinkedIn trial post, audience comments at >= 24 h and impressions at >= 7 days (exports carry no
//   per-post comment count and no measurement window);
// - the results (GET /api/admin/growth/trial/results; maths in lib/growth/trialAnalysis.ts).

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { DailyPosts } from './DailyPosts'
import { trialPhase, TRIAL_FINAL_DATE } from '@/lib/growth/trial'
import type { TrialAnalysis, SplitResult } from '@/lib/growth/trialAnalysis'

type LinkedinRow = {
  approval_id: string; trial_date: string; variant: string | null
  li_comments: number | null; li_comments_age_hours: number | null; li_impressions: number | null; li_impressions_age_hours: number | null
  growth_agent_memory: { created_at: string; posted_url: string | null } | null
  articles: { title: string } | null
}
type Results = Omit<TrialAnalysis, 'posts'> & { final: boolean; generated_at: string; trialPosts: unknown[] }

const card = 'bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5'
const fmt = (x: number | null | undefined, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? '—' : x.toFixed(d))
const pct = (x: number | null | undefined) => (x === null || x === undefined || Number.isNaN(x) ? '—' : `${Math.round(x * 100)}%`)
const CHANNEL_NAME: Record<string, string> = {
  whatsapp: 'WhatsApp', telegram: 'Telegram', linkedin: 'LinkedIn', facebook_il: 'Facebook IL', facebook_intl: 'Facebook Intl', google: 'Google',
}

export function TrialTab() {
  const phase = trialPhase(new Date())
  return (
    <div className="space-y-8">
      <div className={card}>
        <h2 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">🧪 December Trial · 2026-12-01 → 12-31</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Post from here all of December (Daily Posts is unchanged and won&apos;t record in December). LinkedIn daily in the new
          format with your own take; WhatsApp + Telegram on Sun / Mon / Tue / Thu; Facebook IL + Intl unchanged; no X. Two
          randomised splits, fixed in advance: LinkedIn link in the post vs the first comment, WhatsApp short vs current
          format. Results are final on {TRIAL_FINAL_DATE}, when every December post has had 7 days. Every Monday, upload a
          7-day LinkedIn export (weekly totals).
        </p>
      </div>
      {phase !== 'ended' && <DailyPosts mode="trial" />}
      <LinkedinToRecord />
      <TrialResults />
    </div>
  )
}

function LinkedinToRecord() {
  const [rows, setRows] = useState<LinkedinRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/growth/trial/today')
      const data = await res.json()
      if (!res.ok) throw new Error(data.details || data.error || `HTTP ${res.status}`)
      setRows(data.linkedin ?? []); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (approvalId: string, kind: 'comments' | 'impressions') => {
    const key = `${approvalId}:${kind}`
    const raw = (drafts[key] ?? '').trim()
    const value = Number(raw)
    // a cleared box is "not measured", never a measured zero
    if (!raw || !Number.isInteger(value) || value < 0) { setError('Enter a whole number ≥ 0'); return }
    setSaving(key)
    try {
      const res = await fetch('/api/admin/growth/trial/metric', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approval_id: approvalId, kind, value }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setDrafts(d => { const n = { ...d }; delete n[key]; return n })
      await load()
    } catch (e) { setError(`Not saved: ${e instanceof Error ? e.message : String(e)}`) } finally { setSaving(null) }
  }

  if (!rows?.length && !error) return null
  const ageH = (r: LinkedinRow) => (r.growth_agent_memory ? (Date.now() - Date.parse(r.growth_agent_memory.created_at)) / 3600000 : 0)
  const field = (r: LinkedinRow, kind: 'comments' | 'impressions', due: boolean) => {
    const key = `${r.approval_id}:${kind}`
    const stored = kind === 'comments' ? r.li_comments : r.li_impressions
    const age = kind === 'comments' ? r.li_comments_age_hours : r.li_impressions_age_hours
    if (!due && stored === null) return <span className="text-xs text-zinc-500">{kind === 'comments' ? 'at 24 h' : 'at 7 days'}</span>
    return (
      <span className="flex items-center gap-1">
        <input type="number" min={0} value={drafts[key] ?? (stored ?? '')} onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
          className="w-20 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-1" aria-label={`${kind} for ${r.trial_date}`} />
        {drafts[key] !== undefined && <button type="button" disabled={saving === key} onClick={() => save(r.approval_id, kind)} className="text-xs px-2 py-1 bg-emerald-700 text-white rounded disabled:opacity-50">Save</button>}
        {stored !== null && <span className="text-[11px] text-zinc-500">at {fmt(age, 0)} h</span>}
      </span>
    )
  }
  return (
    <div className={card} data-testid="trial-to-record">
      <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">✍️ LinkedIn — to record</h3>
      <p className="text-xs text-zinc-500 mt-1 mb-3">Comments: other people&apos;s comments only (not your link comment or your replies), entered once the post is a day old. Impressions: the number LinkedIn shows on the post, at 7 days.</p>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-zinc-500"><th className="py-1 pr-3">Date</th><th className="pr-3">Post</th><th className="pr-3">Link</th><th className="pr-3">Comments</th><th>Impressions</th></tr></thead>
          <tbody>
            {(rows ?? []).map(r => (
              <tr key={r.approval_id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-1.5 pr-3 whitespace-nowrap">{r.trial_date}</td>
                <td className="pr-3 max-w-[260px] truncate">{r.growth_agent_memory?.posted_url ? <a href={r.growth_agent_memory.posted_url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">{r.articles?.title ?? 'post'}</a> : (r.articles?.title ?? '—')}</td>
                <td className="pr-3 whitespace-nowrap">{r.variant === 'first_comment' ? 'first comment' : 'in post'}</td>
                <td className="pr-3">{field(r, 'comments', ageH(r) >= 24)}</td>
                <td>{field(r, 'impressions', ageH(r) >= 24 * 7)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SplitCard({ title, primary, s, unit }: { title: string; primary?: boolean; s: SplitResult; unit: string }) {
  const [a, b] = s.arms
  return (
    <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">{title}</p>
        {primary && <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">primary</span>}
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
        {a.name}: {fmt(a.mean)} {unit}/post (n = {a.n}) · {b.name}: {fmt(b.mean)} {unit}/post (n = {b.n})
      </p>
      <p className="text-xs mt-1 text-zinc-700 dark:text-zinc-300">
        {s.verdict === 'too_few'
          ? `Too few to tell yet (each side needs ≥ 8 measured posts)`
          : <>Difference {b.name} − {a.name}: {fmt(s.diff)} (90% interval {fmt(s.ci90?.[0])} to {fmt(s.ci90?.[1])}; p = {fmt(s.p, 2)}){s.ratio !== null && ` · ×${fmt(s.ratio, 2)}`} — {s.verdict === 'difference' ? 'a difference' : 'no clear difference'}</>}
      </p>
    </div>
  )
}

function TrialResults() {
  const [r, setR] = useState<Results | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/growth/trial/results')
      const data = await res.json()
      if (!res.ok) throw new Error(data.details || data.error || `HTTP ${res.status}`)
      setR(data); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setLoading(false) }
  }
  if (!r) {
    return (
      <div className={card}>
        <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">📊 Trial results</h3>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <button type="button" onClick={load} disabled={loading} className="mt-3 px-4 py-2 text-sm bg-[#3D7A5F] text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
          {loading ? <><Loader2 size={14} className="animate-spin" /> Reading December…</> : 'Load results'}
        </button>
      </div>
    )
  }
  const row = (channel: string, period: 'baseline' | 'trial') => r.scorecard.find(x => x.channel === channel && x.period === period)
  return (
    <div className="space-y-6" data-testid="trial-results">
      <div className={card}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">📊 Trial results {r.final ? '— final' : `— provisional (final on ${TRIAL_FINAL_DATE})`}</h3>
          <button type="button" onClick={load} disabled={loading} className="text-xs text-emerald-600 hover:underline">{loading ? 'Reading…' : '↻ Refresh'}</button>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          A post counts once it has had 7 days ({r.attribution.maturing} trial posts still maturing). Visits = arrivals from that post&apos;s link
          (organic, human). {r.attribution.outsideTrial > 0 && `${r.attribution.outsideTrial} December posts were marked outside the trial tab and are left out. `}
          Baseline matches by article: {r.attribution.ambiguous} arrivals fitted more than one post (credited to the latest).
        </p>
      </div>

      <div className={card}>
        <h4 className="text-sm font-semibold mb-1 text-[#1A1A1A] dark:text-[#E8E8E8]">1 · Randomised splits — the only like-for-like comparisons</h4>
        <p className="text-xs text-zinc-500 mb-3">Fixed in advance, balanced within each week. The decision rule set before the trial: act only on a primary result with a clear difference of about ×1.5 or more, read on {TRIAL_FINAL_DATE}.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <SplitCard title="LinkedIn link: in post vs first comment — audience comments" primary s={r.splits.linkedin_comments} unit="comments" />
          <SplitCard title="LinkedIn link — impressions (as entered at ~7 days)" s={r.splits.linkedin_impressions} unit="impressions" />
          <SplitCard title="LinkedIn link — visits to the article" s={r.splits.linkedin_visits} unit="visits" />
          <SplitCard title="WhatsApp + Telegram: current vs short format — visits" primary s={r.splits.whatsapp_visits} unit="visits" />
        </div>
      </div>

      <div className={card}>
        <h4 className="text-sm font-semibold mb-1 text-[#1A1A1A] dark:text-[#E8E8E8]">2 · December vs the Oct 13 – Nov 30 baseline — descriptive, not controlled</h4>
        <p className="text-xs text-zinc-500 mb-3">The LinkedIn format, the WhatsApp cadence and December itself (Hanukkah, Christmas) all changed at once; Facebook is unchanged and shown as context, not as a correction.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-zinc-500"><th className="py-1 pr-3">Channel</th><th className="pr-3">Posts (7 days old)</th><th className="pr-3">Visits / post</th><th className="pr-3">Posts with a visit</th><th className="pr-3">Stayed ≥ 30 s</th><th className="pr-3">Signups</th><th>Signups / 100 arrivals</th></tr></thead>
            <tbody>
              {['whatsapp', 'telegram', 'linkedin', 'facebook_il', 'facebook_intl'].map(ch => {
                const b = row(ch, 'baseline'); const t = row(ch, 'trial')
                const cell = (f: (x: NonNullable<typeof b>) => string) => <>{b ? f(b) : '—'} → <b>{t ? f(t) : '—'}</b></>
                return (
                  <tr key={ch} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{CHANNEL_NAME[ch]}{ch.startsWith('facebook') && <span className="text-zinc-500"> (unchanged)</span>}</td>
                    <td className="pr-3">{cell(x => String(x.mature))}</td>
                    <td className="pr-3">{cell(x => fmt(x.meanVisits))}</td>
                    <td className="pr-3">{cell(x => pct(x.shareWithVisit))}</td>
                    <td className="pr-3">{cell(x => pct(x.engagedShare))}</td>
                    <td className="pr-3">{cell(x => String(x.signups))}</td>
                    <td>{cell(x => fmt(x.signupsPer100))}</td>
                  </tr>
                )
              })}
              {r.google.length === 2 && (
                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-1.5 pr-3">Google <span className="text-zinc-500">(not posted)</span></td><td className="pr-3">—</td>
                  <td className="pr-3">{r.google[0].arrivals} → <b>{r.google[1].arrivals}</b> arrivals</td><td className="pr-3">—</td><td className="pr-3">—</td>
                  <td className="pr-3">{r.google[0].signups} → <b>{r.google[1].signups}</b></td><td>{fmt(r.google[0].signupsPer100)} → <b>{fmt(r.google[1].signupsPer100)}</b></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          LinkedIn impressions per day (all posts, from the uploaded exports): baseline {fmt(r.linkedinTotals.baseline.perDay, 0)} ({r.linkedinTotals.baseline.days} days) → December {fmt(r.linkedinTotals.trial.perDay, 0)} ({r.linkedinTotals.trial.days} days) · December 2025: {fmt(r.linkedinTotals.december2025.perDay, 0)}. Latest export day: {r.linkedinTotals.latestDate ?? '—'}.
          {' '}Signups are matched to the visit that preceded them (same account or network address, 24 h) — approximate: {r.signupSummary.unattributed} of {r.signupSummary.total} unmatched, {r.signupSummary.ambiguous} had more than one source (first one counted).
        </p>
      </div>

      <div className={card}>
        <h4 className="text-sm font-semibold mb-1 text-[#1A1A1A] dark:text-[#E8E8E8]">3 · What goes with more visits — patterns, not causes</h4>
        <p className="text-xs text-zinc-500 mb-3">One row per article-day (one article on five platforms is one observation), baseline + December. Grey: fewer than 10 article-days.</p>
        <DriverTable rows={r.drivers} />
        {r.textDrivers.length > 0 && <>
          <p className="text-xs text-zinc-500 mt-4 mb-2">Post text (trial posts only — earlier posts stored just their first line)</p>
          <DriverTable rows={r.textDrivers.map(d => ({ ...d, factor: `${CHANNEL_NAME[d.channel]} · ${d.factor}` }))} unit="posts" />
        </>}
      </div>

      <div className={card}>
        <h4 className="text-sm font-semibold mb-2 text-[#1A1A1A] dark:text-[#E8E8E8]">4 · December arrivals → signup</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-zinc-500"><th className="py-1 pr-3">Source</th><th className="pr-3">Arrivals</th><th className="pr-3">Saw the free-article limit</th><th className="pr-3">Opened signup</th><th>Signed up</th></tr></thead>
            <tbody>
              {r.funnel.map(f => (
                <tr key={f.source} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-1.5 pr-3">{CHANNEL_NAME[f.source]}</td><td className="pr-3">{f.arrivals}</td><td className="pr-3">{f.wallShown}</td><td className="pr-3">{f.signupViewed}</td><td>{f.signups}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DriverTable({ rows, unit = 'article-days' }: { rows: { factor: string; bucket: string; articleDays: number; meanVisits: number; shareWithVisit: number; greyed: boolean }[]; unit?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-zinc-500"><th className="py-1 pr-3">Factor</th><th className="pr-3">Group</th><th className="pr-3">{unit}</th><th className="pr-3">Visits each</th><th>With ≥ 1 visit</th></tr></thead>
        <tbody>
          {rows.map(d => (
            <tr key={`${d.factor}|${d.bucket}`} className={`border-t border-zinc-200 dark:border-zinc-800 ${d.greyed ? 'text-zinc-400 dark:text-zinc-600' : ''}`}>
              <td className="py-1 pr-3">{d.factor}</td><td className="pr-3">{d.bucket}</td><td className="pr-3">{d.articleDays}</td><td className="pr-3">{fmt(d.meanVisits)}</td><td>{pct(d.shareWithVisit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
