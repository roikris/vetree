// growth-006: how the December trial's article of the day was chosen (lib/growth/pickSource.ts) — normalisation, the
// panel's article binding, the post-commit write that must never fail a recorded post, and the day's source.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  normalizePickSource, pickSourceFor, pickAfterGenerate, daySource, logPickSource, PICK_SOURCES, type PickLogClient,
} from '../../lib/growth/pickSource'

test('normalizePickSource: known values pass, anything else is unknown', () => {
  for (const s of PICK_SOURCES) assert.equal(normalizePickSource(s), s)
  for (const v of [undefined, null, '', 'AUTO', 'random', 3, {}]) assert.equal(normalizePickSource(v), 'unknown')
})

test('the migration CHECK lists exactly PICK_SOURCES', () => {
  const sql = readFileSync('supabase/migrations/091_trial_pick_source.sql', 'utf8')
  const list = sql.match(/pick_source IN \(([^)]*)\)/)![1].match(/'([^']+)'/g)!.map(x => x.slice(1, -1))
  assert.deepEqual(list, [...PICK_SOURCES])
})

test('pickSourceFor: only a pick for the article being marked is sent', () => {
  const pick = { articleId: 'A', source: 'recommendation' as const }
  assert.equal(pickSourceFor(pick, 'A'), 'recommendation')
  assert.equal(pickSourceFor(pick, 'B'), undefined)
  assert.equal(pickSourceFor(null, 'A'), undefined)
  assert.equal(pickSourceFor(pick, null), undefined)
})

test('pickAfterGenerate: server pick, forced selection, keep-existing, fixed day', () => {
  const prev = { articleId: 'A', source: 'search' as const }
  assert.deepEqual(pickAfterGenerate({ sharedId: 'X', dayFixed: false, serverPicked: true, selected: null, previous: prev }), { articleId: 'X', source: 'auto' })
  assert.deepEqual(pickAfterGenerate({ sharedId: 'R', dayFixed: false, serverPicked: false, selected: { id: 'R', source: 'recommendation' }, previous: prev }), { articleId: 'R', source: 'recommendation' })
  assert.deepEqual(pickAfterGenerate({ sharedId: 'S', dayFixed: false, serverPicked: false, selected: { id: 'S' }, previous: null }), { articleId: 'S', source: 'unknown' })
  // keep existing drafts' article: the stored pick if it is for that article, else nothing
  assert.deepEqual(pickAfterGenerate({ sharedId: 'A', dayFixed: false, serverPicked: false, selected: null, previous: prev }), prev)
  assert.equal(pickAfterGenerate({ sharedId: 'B', dayFixed: false, serverPicked: false, selected: null, previous: prev }), null)
  // the day is fixed: never re-labelled (a forced continuation is not 'auto' or the selection)
  assert.deepEqual(pickAfterGenerate({ sharedId: 'A', dayFixed: true, serverPicked: false, selected: { id: 'A', source: 'recommendation' }, previous: prev }), prev)
  assert.equal(pickAfterGenerate({ sharedId: 'A', dayFixed: true, serverPicked: false, selected: null, previous: null }), null)
  assert.deepEqual(pickAfterGenerate({ sharedId: null, dayFixed: false, serverPicked: false, selected: null, previous: prev }), prev)
})

const client = (result: () => PromiseLike<{ error: { message: string } | null }>, seen: unknown[] = []): PickLogClient => ({
  from: (table) => ({
    update: (v) => ({
      eq: (col, id) => ({
        is: (c2, n) => ({ abortSignal: () => { seen.push([table, v, col, id, c2, n]); return result() } }),
      }),
    }),
  }),
})

test('logPickSource: writes only an empty pick_source on that approval', async () => {
  const seen: unknown[] = []
  let failed = 0
  assert.equal(await logPickSource(client(async () => ({ error: null }), seen), 'ap-1', 'auto', () => failed++), true)
  assert.deepEqual(seen, [['growth_trial_posts', { pick_source: 'auto' }, 'approval_id', 'ap-1', 'pick_source', null]])
  assert.equal(failed, 0)
})

test('logPickSource: an error, a throw, a hang or a missing id → false, reported, never thrown', async () => {
  let failed = 0
  const onFail = () => { failed++ }
  assert.equal(await logPickSource(client(async () => ({ error: { message: 'boom' } })), 'ap', 'search', onFail), false)
  assert.equal(await logPickSource(client(() => { throw new Error('network') }), 'ap', 'search', onFail), false)
  assert.equal(await logPickSource(client(async () => { throw new Error('aborted') }), 'ap', 'search', onFail), false)
  const t0 = Date.now()
  assert.equal(await logPickSource(client(() => new Promise(() => {})), 'ap', 'search', onFail, 50), false)
  assert.ok(Date.now() - t0 < 1000, 'a hanging write is cut off at the timeout')
  assert.equal(await logPickSource(client(async () => ({ error: null })), undefined, 'search', onFail), false)
  assert.equal(failed, 5)
})

test('daySource: earliest known value; unknown only when nothing better; disagreement flagged', () => {
  const r = (created_at: string, approval_id: string, pick_source: string | null) => ({ created_at, approval_id, pick_source })
  assert.deepEqual(daySource([]), { source: null, disagree: false })
  assert.deepEqual(daySource([r('2026-12-01T08:00:00Z', 'b', null)]), { source: null, disagree: false })
  assert.deepEqual(daySource([r('2026-12-01T08:00:00Z', 'b', 'unknown'), r('2026-12-01T09:00:00Z', 'c', null)]), { source: 'unknown', disagree: false })
  assert.deepEqual(daySource([r('2026-12-01T09:00:00Z', 'a', 'search'), r('2026-12-01T08:00:00Z', 'z', 'unknown'), r('2026-12-01T08:00:00Z', 'y', 'auto')]), { source: 'auto', disagree: true })
  // same time → approval id breaks the tie
  assert.deepEqual(daySource([r('2026-12-01T08:00:00Z', 'b', 'search'), r('2026-12-01T08:00:00Z', 'a', 'recommendation')]), { source: 'recommendation', disagree: true })
})
