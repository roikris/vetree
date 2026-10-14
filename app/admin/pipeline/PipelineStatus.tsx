'use client'

// Pipeline (admin-002): the daily Slack messages, expanded — from what the jobs leave in the database
// (GET /api/admin/pipeline/status). No run totals and no OK / late verdicts: the jobs don't store their run
// summaries, so each job shows its latest activity next to its schedule and a link to its GitHub runs.

import { useCallback, useEffect, useRef, useState } from 'react'
import { SCHEDULED_JOBS, israelSchedule, workflowUrl, ageDays } from '@/lib/pipeline/status'

type Item = {
  id: string; title: string | null; article_url: string | null; pubmed_id: string | null; source_journal: string | null
  created_at: string; enrichment_attempts: number | null; last_enrichment_at: string | null
  last_enrichment_error: string | null; quarantine_reason: string | null
}
type ListKey = 'waiting_for_codex' | 'failed' | 'missing_abstract'
type Status = {
  generated_at: string
  today: string
  activity: {
    sync: string | null; enrichment: string | null; snapshot: string | null
    digest: { created_at: string; status: string | null; sent_count: number | null; skipped_count: number | null; total_users: number | null; triggered_by: string | null; error_message: string | null } | null
    security: { generated_at: string; severity: string | null; status: string | null; triggered_by: string | null } | null
  }
  added_today: { total: number; by_journal: { journal: string; count: number }[] }
  latest_skips: { sync_run_at: string | null; total: number; groups: { reason: string; count: number; samples: { title: string; url: string | null }[] }[] }
  needs_you: {
    waiting_for_codex: { count: number; items: Item[] }
    failed: { count: number; items: Item[] }
    missing_abstract: { count: number; items: Item[] }
    queue: { queued: number; runnable: number }
  }
  visibility: { total: number; visible: number; queued: number; hidden: number; hidden_by_reason: { reason: string; count: number }[]; unexplained: number }
}

// The admin "Almanac" look (app/globals.css --al-* tokens, as Analytics): cream / ink, Spectral headings, Instrument text
const line = (a: number) => `rgba(var(--al-line, 62,54,36), ${a})`
const sans = 'var(--font-instrument, sans-serif)'
const serif = 'var(--font-spectral, serif)'
const S = {
  card: { background: 'var(--al-card)', border: `1px solid ${line(0.09)}`, borderRadius: 14, padding: '22px 24px' },
  h2: { margin: '0 0 6px', fontFamily: serif, fontSize: 18, fontWeight: 600, lineHeight: 1.2, color: 'var(--al-ink2)' },
  h3: { margin: 0, fontFamily: serif, fontSize: 15.5, fontWeight: 600, lineHeight: 1.3, color: 'var(--al-ink3)' },
  text: { fontFamily: sans, fontSize: 13, lineHeight: 1.5, color: 'var(--al-body)' },
  muted: { fontFamily: sans, fontSize: 12.5, lineHeight: 1.5, color: 'var(--al-mut3)' },
  label: { fontFamily: sans, fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--al-mut4)', lineHeight: 1 },
  bigNum: { fontFamily: serif, fontSize: 26, fontWeight: 600, lineHeight: 1, color: 'var(--al-accent)', marginTop: 8 },
  title: { fontFamily: sans, fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, color: 'var(--al-ink3)' },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, lineHeight: 1.45, color: 'var(--al-warntext)' },
  link: { color: 'var(--al-accent)', textDecoration: 'underline', textUnderlineOffset: 2 },
  th: { padding: '10px 14px 10px 0', textAlign: 'left' as const, fontFamily: sans, fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--al-mut4)', borderBottom: `1px solid ${line(0.09)}` },
  td: { padding: '10px 14px 10px 0', fontFamily: sans, fontSize: 13, color: 'var(--al-ink4)', lineHeight: 1.4, borderBottom: `1px solid ${line(0.06)}`, verticalAlign: 'top' as const },
  rowLine: `1px solid ${line(0.07)}`,
}
const button = (kind: 'primary' | 'quiet' | 'danger', disabled = false): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: sans, fontSize: 13, fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap', transition: 'all .13s ease',
  opacity: disabled ? 0.5 : 1,
  background: kind === 'primary' ? 'var(--al-accent)' : kind === 'danger' ? 'rgba(var(--al-warnc, 176,116,20), .9)' : line(0.08),
  color: kind === 'quiet' ? 'var(--al-sub)' : 'var(--al-on-accent)',
})
const notice = (ok: boolean): React.CSSProperties => ({
  margin: 0, padding: '10px 14px', borderRadius: 10, fontFamily: sans, fontSize: 12.5, lineHeight: 1.5,
  background: ok ? 'rgba(var(--al-acct, 95,140,51), .1)' : 'rgba(var(--al-warnc, 176,116,20), .12)',
  color: ok ? 'var(--al-ink3)' : 'var(--al-warntext)',
})
const count = (n: number): React.CSSProperties => ({ color: n > 0 ? 'rgb(var(--al-warnc, 176,116,20))' : 'var(--al-mut6)', fontWeight: 600 })

const when = (iso: string | null | undefined) => iso
  ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  : '—'
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const sourceUrl = (a: Item) => a.article_url || (a.pubmed_id ? `https://pubmed.ncbi.nlm.nih.gov/${a.pubmed_id}/` : null)

function ArticleRow({ a, now, onDelete }: { a: Item; now: Date; onDelete?: (id: string) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const age = ageDays(a.last_enrichment_at ?? a.created_at, now)
  const src = sourceUrl(a)
  return (
    <li style={{ padding: '12px 0', borderTop: S.rowLine, listStyle: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <div style={S.title}>{a.title || '(untitled)'}</div>
          <div style={{ ...S.muted, marginTop: 2 }}>
            {a.source_journal || 'no journal'} · {plural(a.enrichment_attempts ?? 0, 'attempt')}
            {age !== null && <> · last activity {age === 0 ? 'today' : `${plural(age, 'day')} ago`}</>}
            {src && <> · <a href={src} target="_blank" rel="noopener noreferrer" style={S.link}>source</a></>}
          </div>
          {a.last_enrichment_error && <div style={{ ...S.mono, marginTop: 4 }}>{a.last_enrichment_error}</div>}
        </div>
        {onDelete && (
          <div style={{ flexShrink: 0, display: 'flex', gap: 8 }}>
            {confirming ? (
              <>
                <button type="button" style={button('danger', deleting)} disabled={deleting} data-testid="delete-confirm"
                  onClick={async () => { setDeleting(true); try { await onDelete(a.id) } finally { setDeleting(false); setConfirming(false) } }}>
                  {deleting ? 'Deleting…' : 'Delete + block'}
                </button>
                <button type="button" style={button('quiet', deleting)} disabled={deleting} onClick={() => setConfirming(false)}>Cancel</button>
              </>
            ) : (
              <button type="button" style={button('quiet')} onClick={() => setConfirming(true)} title="Deletes the article and blocks its PubMed id from future syncs">
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function Group({ title, n, hint, items, now, onDelete, onMore, loadingMore, moreDisabled, children, testId, first }: {
  title: string; n: number; hint: string; items: Item[]; now: Date; onDelete?: (id: string) => Promise<void>
  onMore: () => void; loadingMore: boolean; moreDisabled: boolean; children?: React.ReactNode; testId: string; first?: boolean
}) {
  return (
    <div style={{ marginTop: first ? 0 : 22, paddingTop: first ? 0 : 18, borderTop: first ? 'none' : `1px solid ${line(0.09)}` }} data-testid={testId}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h3 style={S.h3}>{title} <span style={count(n)}>({n})</span></h3>
        {children}
      </div>
      <p style={{ ...S.muted, margin: '4px 0 0' }}>{hint}</p>
      {items.length > 0 && <ul style={{ margin: '8px 0 0', padding: 0 }}>{items.map(a => <ArticleRow key={a.id} a={a} now={now} onDelete={onDelete} />)}</ul>}
      {n > items.length && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={S.muted}>Showing {items.length} of {n}.</span>
          <button type="button" style={button('quiet', moreDisabled)} disabled={moreDisabled} onClick={onMore} data-testid={`${testId}-more`}>
            {loadingMore ? 'Loading…' : 'Show more'}
          </button>
        </div>
      )}
    </div>
  )
}

export function PipelineStatus() {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<null | 'retry' | 'run'>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const [more, setMore] = useState<ListKey | null>(null)
  // Every read gets a number; only the newest one may update the page (a slow older refresh must never
  // overwrite the state read after a Retry or a Delete). "Show more" pages belong to the read they extend.
  const seq = useRef(0)

  const load = useCallback(async () => {
    const mine = ++seq.current
    setLoading(true)
    setMore(null)
    try {
      const res = await fetch('/api/admin/pipeline/status', { cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      if (mine !== seq.current) return
      setStatus(body as Status)
      setError(null)
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [])

  // One page load at a time, never during a refresh (the buttons are disabled meanwhile), so the offset
  // always belongs to the list on screen; rows are merged by id as a last guard against duplicates.
  const loadMore = async (key: ListKey) => {
    if (!status || loading || more !== null) return
    const mine = seq.current
    const offset = status.needs_you[key].items.length
    setMore(key)
    try {
      const res = await fetch(`/api/admin/pipeline/status?list=${key}&offset=${offset}`, { cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      if (mine !== seq.current) return
      setStatus(prev => prev && {
        ...prev,
        needs_you: { ...prev.needs_you, [key]: {
          count: body.count,
          items: [...prev.needs_you[key].items, ...(body.items as Item[]).filter(x => !prev.needs_you[key].items.some(y => y.id === x.id))],
        } },
      })
    } catch (e) {
      if (mine === seq.current) setMessage({ ok: false, text: `Couldn't load more: ${e instanceof Error ? e.message : 'request failed'}` })
    } finally {
      if (mine === seq.current) setMore(null)
    }
  }

  useEffect(() => { load() }, [load])

  const post = async (kind: 'retry' | 'run') => {
    setAction(kind)
    setMessage(null)
    try {
      const res = await fetch(kind === 'retry' ? '/api/enrich-failed' : '/api/trigger-enrichment', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      setMessage(res.ok
        ? { ok: true, text: body.message || (kind === 'retry' ? 'Failed articles re-queued.' : 'Enrichment started.') }
        : { ok: false, text: body.error || `HTTP ${res.status}` })
      if (res.ok) await load()
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setAction(null)
    }
  }

  const remove = async (id: string) => {
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setMessage({ ok: false, text: body.error || `Delete failed (HTTP ${res.status})` }); return }
      setMessage({ ok: true, text: 'Article deleted and blocked from future syncs.' })
    } catch {
      setMessage({ ok: false, text: 'The delete request got no answer — it may or may not have gone through. Refreshing to show the current state.' })
    }
    await load()
  }

  const now = status ? new Date(status.generated_at) : new Date()
  const n = status?.needs_you
  const v = status?.visibility
  const a = status?.activity

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ ...S.muted, margin: 0 }}>
          {status ? <>Read {when(status.generated_at)} (Israel time) · today = {status.today}</> : loading ? 'Loading…' : ''}
        </p>
        <button type="button" style={button('quiet', loading)} onClick={load} disabled={loading} data-testid="refresh">
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <p style={notice(false)} data-testid="load-error">
          Couldn&apos;t read the pipeline status: {error}. Nothing below is current — press Refresh.
        </p>
      )}
      {message && <p style={notice(message.ok)} data-testid="action-message">{message.text}</p>}

      {status && n && v && a && (
        <>
          {/* 1. Needs you — the part Slack can't show */}
          <section style={S.card} data-testid="needs-you">
            <h2 style={{ ...S.h2, marginBottom: 16 }}>Needs you</h2>
            <Group first testId="waiting-codex" onMore={() => loadMore('waiting_for_codex')} loadingMore={more === 'waiting_for_codex'} moreDisabled={loading || more !== null} title="Waiting for the Codex fallback" n={n.waiting_for_codex.count} items={n.waiting_for_codex.items} now={now}
              hint="Claude refused these; they stay hidden until the fallback runs on your Mac: npm run enrich:refused -- --dry-run, then npm run enrich:refused." />
            <Group testId="failed" onMore={() => loadMore('failed')} loadingMore={more === 'failed'} moreDisabled={loading || more !== null} title="Failed — can be retried" n={n.failed.count} items={n.failed.items} now={now} onDelete={remove}
              hint="Enrichment failed 3 times (or the job hid it). Retry failed re-queues all of them and starts the enrichment job; it un-hides only articles the job hid (an admin, no-abstract or unknown quarantine stays).">
              <button type="button" style={button('primary', action !== null || n.failed.count === 0)} disabled={action !== null || n.failed.count === 0} onClick={() => post('retry')} data-testid="retry-failed">
                {action === 'retry' ? 'Re-queuing…' : `Retry failed (${n.failed.count})`}
              </button>
            </Group>
            <Group testId="missing-abstract" onMore={() => loadMore('missing_abstract')} loadingMore={more === 'missing_abstract'} moreDisabled={loading || more !== null} title="No source abstract — can't be enriched" n={n.missing_abstract.count} items={n.missing_abstract.items} now={now} onDelete={remove}
              hint="The job only ever enriches from the source abstract. Check the source; delete the article if it has none." />
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${line(0.09)}` }} data-testid="queue">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <h3 style={S.h3}>Queue</h3>
                <button type="button" style={button('primary', action !== null || n.queue.runnable === 0)} disabled={action !== null || n.queue.runnable === 0} onClick={() => post('run')} data-testid="run-enrichment">
                  {action === 'run' ? 'Starting…' : `Run enrichment (${n.queue.runnable})`}
                </button>
              </div>
              <p style={{ ...S.muted, margin: '4px 0 0' }}>
                {plural(n.queue.queued, 'article')} queued; {n.queue.runnable} eligible for the job (it caps each run)
                {n.queue.queued > n.queue.runnable && ' (the rest: no abstract, out of attempts, or waiting for Codex)'}.
                {' '}The job runs daily at {israelSchedule(SCHEDULED_JOBS.find(j => j.key === 'enrichment')!, now).replace('daily ', '')}.
              </p>
            </div>
          </section>

          {/* 2. Today — the daily sync's Slack message, from the database */}
          <section style={S.card} data-testid="today">
            <h2 style={S.h2}>Today&apos;s sync</h2>
            <p style={{ ...S.text, margin: 0 }}>Articles added today (Israel day, {status.today}): <strong style={{ color: 'var(--al-ink2)' }}>{status.added_today.total}</strong></p>
            {status.added_today.by_journal.length > 0 && (
              <ul style={{ ...S.text, margin: '8px 0 0', paddingLeft: 18 }}>
                {status.added_today.by_journal.map(j => <li key={j.journal}>{j.journal}: {j.count}</li>)}
              </ul>
            )}
            <h3 style={{ ...S.h3, marginTop: 20 }}>
              Latest recorded skips {status.latest_skips.sync_run_at && <span style={{ ...S.muted, fontWeight: 400 }}>— {when(status.latest_skips.sync_run_at)}</span>}
            </h3>
            <p style={{ ...S.muted, margin: '4px 0 0' }}>Only blacklisted and no-abstract skips are recorded, and only for 30 days.</p>
            {status.latest_skips.groups.length === 0 ? <p style={{ ...S.muted, margin: '8px 0 0' }}>None recorded.</p> : (
              <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {status.latest_skips.groups.map(g => (
                  <li key={g.reason} style={S.text}>
                    <span style={{ fontWeight: 600, color: 'var(--al-ink3)' }}>{g.reason}: {g.count}</span>
                    <ul style={{ margin: '2px 0 0', paddingLeft: 18, overflowWrap: 'anywhere' }}>
                      {g.samples.map((x, i) => (
                        <li key={i}>{x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer" style={S.link}>{x.title}</a> : x.title}</li>
                      ))}
                      {g.count > g.samples.length && <li style={{ listStyle: 'none', color: 'var(--al-mut3)' }}>…and {g.count - g.samples.length} more</li>}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 3. Visibility check */}
          <section style={S.card} data-testid="visibility">
            <h2 style={{ ...S.h2, marginBottom: 14 }}>Visibility check</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              {([['Total', v.total], ['Public', v.visible], ['Queued', v.queued], ['Hidden', v.hidden], ['Unexplained', v.unexplained]] as const).map(([label, value]) => (
                <div key={label} style={{ background: 'var(--al-card2)', border: `1px solid ${line(0.07)}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={S.label}>{label}</div>
                  <div style={{ ...S.bigNum, color: label === 'Unexplained' && value > 0 ? 'rgb(var(--al-warnc, 176,116,20))' : label === 'Public' ? 'var(--al-accent)' : 'var(--al-ink2)' }}>
                    {value.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ ...S.muted, margin: '12px 0 0' }}>
              Hidden by reason: {v.hidden_by_reason.length === 0 ? 'none' : v.hidden_by_reason.map(r => `${r.reason} ${r.count}`).join(' · ')}.
              {' '}Unexplained = not queued and not hidden, yet missing its summary or bottom line (should be 0).
            </p>
          </section>

          {/* 4. Scheduled jobs — latest activity, not health */}
          <section style={S.card} data-testid="jobs">
            <h2 style={S.h2}>Scheduled jobs</h2>
            <p style={{ ...S.muted, margin: 0 }}>The latest trace each job left in the database. A run that found nothing leaves no trace — open its runs on GitHub to see whether it ran.</p>
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th style={S.th}>Job</th><th style={S.th}>Schedule (Israel)</th><th style={S.th}>Latest activity</th><th style={S.th}>Runs</th></tr>
                </thead>
                <tbody>
                  {SCHEDULED_JOBS.map(job => {
                    const latest = job.key === 'sync' ? when(a.sync)
                      : job.key === 'enrichment' ? when(a.enrichment)
                      : job.key === 'snapshot' ? (a.snapshot ?? '—')
                      : job.key === 'digest' ? (a.digest ? `${when(a.digest.created_at)} · ${a.digest.status ?? '?'} · sent ${a.digest.sent_count ?? 0} of ${a.digest.total_users ?? 0}${a.digest.triggered_by ? ` · ${a.digest.triggered_by}` : ''}` : '—')
                      : (a.security ? `${when(a.security.generated_at)} · ${a.security.severity ?? '?'} · ${a.security.triggered_by ?? '?'}` : '—')
                    return (
                      <tr key={job.key}>
                        <td style={S.td}>{job.name}<div style={{ ...S.muted, fontSize: 11.5 }}>{job.activity}</div></td>
                        <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{israelSchedule(job, now)}</td>
                        <td style={S.td}>{latest}</td>
                        <td style={S.td}><a href={workflowUrl(job.workflow)} target="_blank" rel="noopener noreferrer" style={S.link}>GitHub</a></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
