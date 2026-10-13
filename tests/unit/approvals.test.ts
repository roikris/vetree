// lib/growth/approvals.ts — one "posted" row per article + platform + Israel day; the double-click guard.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approvedRowToday, onceGuard, type ApprovalClient } from '../../lib/growth/approvals'

type Call = [string, ...unknown[]]
function fakeDb(answer: { data: { id: string } | null; error: { message?: string } | null }) {
  const calls: Call[] = []
  const db: ApprovalClient = {
    from(table: string) {
      calls.push(['from', table])
      const chain = {
        eq: (...a: unknown[]) => (calls.push(['eq', ...a]), chain),
        gte: (...a: unknown[]) => (calls.push(['gte', ...a]), chain),
        lt: (...a: unknown[]) => (calls.push(['lt', ...a]), chain),
        order: (...a: unknown[]) => (calls.push(['order', ...a]), chain),
        limit: (...a: unknown[]) => (calls.push(['limit', ...a]), chain),
        maybeSingle: () => Promise.resolve(answer),
      }
      return { select: (c: string) => (calls.push(['select', c]), chain) }
    },
  }
  return { db, calls }
}

test('looks for this article + platform, approved, within the Israel day of now', async () => {
  const { db, calls } = fakeDb({ data: { id: 'row-1' }, error: null })
  // 00:30 in Israel on 2026-10-13 (21:30 UTC the evening before)
  assert.deepEqual(await approvedRowToday(db, 'pubmed-1', 'linkedin', new Date('2026-10-12T21:30:00Z')), { id: 'row-1' })
  assert.deepEqual(calls, [
    ['from', 'growth_agent_memory'], ['select', 'id'],
    ['eq', 'article_id', 'pubmed-1'], ['eq', 'platform', 'linkedin'], ['eq', 'outcome', 'approved'],
    ['gte', 'created_at', '2026-10-12T21:00:00.000Z'], ['lt', 'created_at', '2026-10-13T21:00:00.000Z'],
    ['order', 'created_at', { ascending: true }], ['limit', 1],
  ])
})

test('the next Israel day is a different window (a repost is a new row)', async () => {
  const a = fakeDb({ data: null, error: null })
  await approvedRowToday(a.db, 'pubmed-1', 'linkedin', new Date('2026-10-13T20:59:00Z')) // 23:59 IDT, the 13th
  const b = fakeDb({ data: null, error: null })
  await approvedRowToday(b.db, 'pubmed-1', 'linkedin', new Date('2026-10-13T21:01:00Z')) // 00:01 IDT, the 14th
  const gte = (c: Call[]) => c.find(x => x[0] === 'gte')?.[2]
  assert.equal(gte(a.calls), '2026-10-12T21:00:00.000Z')
  assert.equal(gte(b.calls), '2026-10-13T21:00:00.000Z')
})

test('nothing yet → null; a read error throws (the route answers 500, never inserts blindly)', async () => {
  assert.equal(await approvedRowToday(fakeDb({ data: null, error: null }).db, 'a', 'x', new Date()), null)
  await assert.rejects(approvedRowToday(fakeDb({ data: null, error: { message: 'boom' } }).db, 'a', 'x', new Date()), /read failed \(boom\)/)
})

test('guard: concurrent clicks share one write, a success is remembered', async () => {
  let writes = 0
  const guard = onceGuard(async () => { writes++; await new Promise(r => setTimeout(r, 5)); return 'id-1' })
  const [a, b] = await Promise.all([guard('linkedin:A'), guard('linkedin:A')])
  assert.equal(a, 'id-1'); assert.equal(b, 'id-1')
  assert.equal(await guard('linkedin:A'), 'id-1')
  assert.equal(writes, 1)
  await guard('twitter:A')
  assert.equal(writes, 2)
})

test('guard: a failed write (null or a thrown error) lets the next click try again', async () => {
  const results: (string | null | Error)[] = [null, new Error('offline'), 'id-2']
  let writes = 0
  const guard = onceGuard(async () => {
    const r = results[writes++]
    if (r instanceof Error) throw r
    return r
  })
  assert.equal(await guard('k'), null)
  await assert.rejects(guard('k'), /offline/)
  assert.equal(await guard('k'), 'id-2')
  assert.equal(writes, 3)
})
