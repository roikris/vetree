import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { FAILED_UNPUBLISHED_OR, AI_REFUSED } from '@/lib/enrichment/requeueFailed'
import { israelDate, israelDayBounds } from '@/lib/growth/daily'
import { byJournal, byReason, groupSkips, type SkipRow } from '@/lib/pipeline/status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/pipeline/status — everything the Pipeline page shows (admin-002), read-only, from what the jobs
// leave in the database: no run totals (they aren't stored) and no job-health verdicts. Any failed query fails the
// whole response, so a read error never shows as a zero.

// Not public — the negation of the public filter (supabase/CLAUDE.md)
// (needs_enrichment is nullable: a NULL flag is not public either — CLAUDE.md rule 5)
const NOT_VISIBLE_OR = 'needs_enrichment.is.null,needs_enrichment.eq.true,summary.is.null,clinical_bottom_line.is.null,quarantined.eq.true'
// The enrichment job's queue (enrich-articles.js): what its next run will actually pick up
const RUNNABLE_OR = `and(or(enrichment_attempts.lt.3,force_retry.eq.true),or(quarantine_reason.is.null,quarantine_reason.neq.${AI_REFUSED}))`
// Not public, not queued, not hidden: nothing explains it
const UNEXPLAINED_OR = 'and(or(needs_enrichment.is.null,summary.is.null,clinical_bottom_line.is.null),or(needs_enrichment.is.null,needs_enrichment.eq.false),or(quarantined.is.null,quarantined.eq.false))'
const ITEM_FIELDS = 'id, title, article_url, pubmed_id, source_journal, created_at, enrichment_attempts, last_enrichment_at, last_enrichment_error, quarantine_reason'
const LIST_LIMIT = 50
const PAGE = 1000

type Count = { count: number | null; error: { message: string } | null }
const must = <T extends { error: { message: string } | null }>(label: string) => (r: T): T => {
  if (r.error) throw new Error(`${label}: ${r.error.message}`)
  return r
}
const n = (r: Count) => r.count ?? 0

type ListKey = 'waiting_for_codex' | 'failed' | 'missing_abstract'
const LIST_KEYS: ListKey[] = ['waiting_for_codex', 'failed', 'missing_abstract']

// One page of a needs-you list, with its exact count; `id` breaks ties so pages never overlap or skip
function listPage(db: ReturnType<typeof createAdminClient>, key: ListKey, offset: number) {
  const base = db.from('articles').select(ITEM_FIELDS, { count: 'exact' })
  const q = key === 'waiting_for_codex'
    ? base.eq('quarantine_reason', AI_REFUSED).order('last_enrichment_at', { ascending: true, nullsFirst: true })
    // the set "Retry failed" re-queues (requeue_failed_articles, lib/enrichment/requeueFailed.ts)
    : key === 'failed'
      ? base.not('abstract', 'is', null).or(FAILED_UNPUBLISHED_OR).not('force_retry', 'is', true)
          .order('last_enrichment_at', { ascending: false, nullsFirst: false })
      // can't be enriched at all: the job only ever enriches from the source abstract
      : base.is('abstract', null).or(NOT_VISIBLE_OR).order('created_at', { ascending: false })
  return q.order('id', { ascending: true }).range(offset, offset + LIST_LIMIT - 1).then(must(key))
}

export async function GET(request: Request) {
  try {
    const cookieClient = await createClient()
    const { data: { user } } = await cookieClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: role, error: roleError } = await cookieClient.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (roleError) return NextResponse.json({ error: 'Role check failed' }, { status: 500 })
    if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const db = createAdminClient()

    // ?list=<key>&offset=<n>: the next page of one needs-you list ("Show more")
    const params = new URL(request.url).searchParams
    const listParam = params.get('list')
    if (listParam !== null) {
      const offset = Number(params.get('offset') ?? '0')
      if (!LIST_KEYS.includes(listParam as ListKey) || !Number.isInteger(offset) || offset < 0) {
        return NextResponse.json({ error: 'Bad list or offset' }, { status: 400 })
      }
      const page = await listPage(db, listParam as ListKey, offset)
      return NextResponse.json({ list: listParam, offset, count: page.count ?? 0, items: page.data ?? [] })
    }
    const now = new Date()
    const today = israelDate(now)
    const { start, end } = israelDayBounds(today)
    const head = () => db.from('articles').select('id', { count: 'exact', head: true })

    // paged reads of small columns (PostgREST returns at most 1000 rows per request)
    async function all<T>(label: string, build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, max = 20_000): Promise<T[]> {
      const out: T[] = []
      for (let from = 0; from < max; from += PAGE) {
        const { data, error } = await build(from, from + PAGE - 1)
        if (error) throw new Error(`${label}: ${error.message}`)
        out.push(...(data ?? []))
        if (!data || data.length < PAGE) return out
      }
      throw new Error(`${label}: more than ${max} rows`)
    }

    const [
      total, visible, queued, runnable, unexplained,
      waiting, failed, noAbstract,
      quarantined, addedToday,
      newestArticle, newestAttempt, newestSkip, digest, security, snapshot,
    ] = await Promise.all([
      head().then(must('total')),
      head().eq('needs_enrichment', false).not('summary', 'is', null).not('clinical_bottom_line', 'is', null)
        .or('quarantined.is.null,quarantined.eq.false').then(must('visible')),
      head().eq('needs_enrichment', true).then(must('queued')),
      head().eq('needs_enrichment', true).not('abstract', 'is', null).or(RUNNABLE_OR).then(must('runnable')),
      // not queued, not hidden, yet missing text: nothing explains why it isn't public
      // (a NULL enrichment flag counts here: it is neither queued nor public)
      head().or(UNEXPLAINED_OR).then(must('unexplained')),

      listPage(db, 'waiting_for_codex', 0), listPage(db, 'failed', 0), listPage(db, 'missing_abstract', 0),

      all<{ quarantine_reason: string | null }>('hidden', (f, t) => db.from('articles').select('quarantine_reason')
        .eq('quarantined', true).order('id').range(f, t)),
      all<{ source_journal: string | null }>('added today', (f, t) => db.from('articles').select('source_journal')
        .gte('created_at', start).lt('created_at', end).order('id').range(f, t)),

      db.from('articles').select('created_at').order('created_at', { ascending: false }).limit(1).then(must('newest article')),
      db.from('articles').select('last_enrichment_at').not('last_enrichment_at', 'is', null)
        .order('last_enrichment_at', { ascending: false }).limit(1).then(must('newest attempt')),
      db.from('sync_skipped_articles').select('sync_run_at').order('sync_run_at', { ascending: false }).limit(1).then(must('newest skip')),
      db.from('digest_runs').select('created_at, status, sent_count, skipped_count, total_users, triggered_by, error_message')
        .order('created_at', { ascending: false }).limit(1).then(must('digest')),
      db.from('security_reports').select('generated_at, severity, status, triggered_by')
        .order('generated_at', { ascending: false }).limit(1).then(must('security')),
      db.from('analytics_daily_snapshot').select('date').order('date', { ascending: false }).limit(1).then(must('snapshot')),
    ])

    const skipRunAt: string | null = newestSkip.data?.[0]?.sync_run_at ?? null
    const skips = skipRunAt
      ? await all<SkipRow>('latest skips', (f, t) => db.from('sync_skipped_articles')
          .select('reason, journal, title, article_url, pubmed_id').eq('sync_run_at', skipRunAt).order('id').range(f, t))
      : []

    return NextResponse.json({
      generated_at: now.toISOString(),
      today,
      activity: {
        sync: newestArticle.data?.[0]?.created_at ?? null,
        enrichment: newestAttempt.data?.[0]?.last_enrichment_at ?? null,
        snapshot: snapshot.data?.[0]?.date ?? null,
        digest: digest.data?.[0] ?? null,
        security: security.data?.[0] ?? null,
      },
      added_today: { total: addedToday.length, by_journal: byJournal(addedToday) },
      latest_skips: { sync_run_at: skipRunAt, total: skips.length, groups: groupSkips(skips) },
      needs_you: {
        waiting_for_codex: { count: n(waiting), items: waiting.data ?? [] },
        failed: { count: n(failed), items: failed.data ?? [] },
        missing_abstract: { count: n(noAbstract), items: noAbstract.data ?? [] },
        queue: { queued: n(queued), runnable: n(runnable) },
      },
      visibility: {
        total: n(total), visible: n(visible), queued: n(queued),
        hidden: quarantined.length, hidden_by_reason: byReason(quarantined), unexplained: n(unexplained),
      },
    })
  } catch (e) {
    console.error('[admin/pipeline/status]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Pipeline status failed' }, { status: 500 })
  }
}
