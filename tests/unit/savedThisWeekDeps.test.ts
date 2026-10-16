// "Articles saved this week" (feed-002): the real data sources in lib/queries/savedThisWeek.ts, with fake Supabase
// clients that record every call — the RPC name and argument names, the deadline on both requests, errors thrown.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { savedThisWeekDeps } from '../../lib/queries/savedThisWeek'

type Call = [string, ...unknown[]]
function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: Call[] = []
  const builder: Record<string, unknown> = {}
  for (const m of ['from', 'select', 'in', 'eq', 'not', 'or']) builder[m] = (...a: unknown[]) => { calls.push([m, ...a]); return builder }
  builder.rpc = (...a: unknown[]) => { calls.push(['rpc', ...a]); return builder }
  builder.abortSignal = (s: AbortSignal) => { calls.push(['abortSignal', s]); return Promise.resolve(result) }
  return { client: builder as unknown as SupabaseClient, calls }
}

const args = { since: '2026-10-08T07:00:00.000Z', until: '2026-10-15T07:00:00.000Z', excluded: ['a', 'b'], limit: 20 }

test('countSaves: saved_this_week with p_* names, through the admin client, under the fill deadline', async () => {
  const admin = fakeClient({ data: [{ article_id: 'x', save_count: '2' }], error: null })
  const anon = fakeClient({ data: [], error: null })
  const signal = new AbortController().signal
  const got = await savedThisWeekDeps(signal, { admin: () => admin.client, anon: () => anon.client }).countSaves(args)
  assert.deepEqual(got, [{ article_id: 'x', save_count: '2' }])
  assert.deepEqual(admin.calls, [
    ['rpc', 'saved_this_week', { p_since: args.since, p_until: args.until, p_excluded: ['a', 'b'], p_limit: 20 }],
    ['abortSignal', signal],
  ])
  assert.equal(anon.calls.length, 0)
})

test('fetchArticles: the anon client, display columns only, the public filter, the same deadline', async () => {
  const admin = fakeClient({ data: [], error: null })
  const anon = fakeClient({ data: [{ id: 'x' }], error: null })
  const signal = new AbortController().signal
  await savedThisWeekDeps(signal, { admin: () => admin.client, anon: () => anon.client }).fetchArticles(['x', 'y'])
  assert.deepEqual(anon.calls, [
    ['from', 'articles'],
    ['select', 'id, title, clinical_bottom_line, labels, source_journal'],
    ['in', 'id', ['x', 'y']],
    ['eq', 'needs_enrichment', false],
    ['not', 'summary', 'is', null],
    ['not', 'clinical_bottom_line', 'is', null],
    ['or', 'quarantined.is.null,quarantined.eq.false'],
    ['abortSignal', signal],
  ])
  assert.equal(admin.calls.length, 0)
})

test('a returned error throws (the fill fails, nothing is cached)', async () => {
  const bad = fakeClient({ data: null, error: { message: 'timeout' } })
  const d = savedThisWeekDeps(new AbortController().signal, { admin: () => bad.client, anon: () => bad.client })
  await assert.rejects(d.countSaves(args), /saved_this_week failed: timeout/)
  await assert.rejects(d.fetchArticles(['x']), /saved-this-week articles failed: timeout/)
})
