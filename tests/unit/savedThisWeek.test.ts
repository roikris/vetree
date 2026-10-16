// "Articles saved this week" (feed-002): lib/queries/savedThisWeekCore.ts with fake data sources — offline.
// The SQL itself (counting, exclusions, ties, window, limit) is checked in replay: docs/harness/test/replay/saved-this-week.sql
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HOUR_MS, loadSavedThisWeek, weekWindow, type ArticleRow, type SaveCount, type SavedThisWeekDeps } from '../../lib/queries/savedThisWeekCore'

const HOUR = Date.UTC(2026, 9, 15, 7) / HOUR_MS   // 2026-10-15 07:00 UTC
const row = (id: string, labels: string[] | null = ['Small Animal']): ArticleRow =>
  ({ id, title: `t ${id}`, clinical_bottom_line: 'b', labels, source_journal: 'J' })

function deps(counts: SaveCount[], rows: ArticleRow[], over: Partial<SavedThisWeekDeps> = {}) {
  const calls: { count: unknown[]; fetch: string[][] } = { count: [], fetch: [] }
  const d: SavedThisWeekDeps = {
    excludedIds: async () => ['admin', 'tester'],
    countSaves: async (args) => { calls.count.push(args); return counts },
    fetchArticles: async (ids) => { calls.fetch.push(ids); return rows },
    ...over,
  }
  return { d, calls }
}

test('window: the 7 days before the start of the hour', () => {
  assert.deepEqual(weekWindow(HOUR), { since: '2026-10-08T07:00:00.000Z', until: '2026-10-15T07:00:00.000Z' })
})

test('the count gets the window, the excluded ids and a limit of 20; the order from SQL is kept', async () => {
  const counts = [{ article_id: 'c', save_count: '4' }, { article_id: 'a', save_count: 2 }, { article_id: 'b', save_count: 2 }]
  const { d, calls } = deps(counts, [row('a'), row('b'), row('c')])   // rows come back in another order
  const got = await loadSavedThisWeek(HOUR, d)
  assert.deepEqual(calls.count, [{ ...weekWindow(HOUR), excluded: ['admin', 'tester'], limit: 20 }])
  assert.deepEqual(calls.fetch, [['c', 'a', 'b']])
  assert.deepEqual(got.map((a) => [a.id, a.save_count]), [['c', 4], ['a', 2], ['b', 2]])   // bigint string → number
})

test('large-animal-only articles are dropped, mixed ones kept; at most 5', async () => {
  const ids = ['h1', 'm1', 'x1', 'x2', 'x3', 'x4', 'x5']
  const counts = ids.map((id) => ({ article_id: id, save_count: 1 }))
  const rows = [row('h1', ['Equine']), row('m1', ['Equine', 'Small Animal']), ...ids.slice(2).map((id) => row(id))]
  const got = await loadSavedThisWeek(HOUR, deps(counts, rows).d)
  assert.deepEqual(got.map((a) => a.id), ['m1', 'x1', 'x2', 'x3', 'x4'])
})

test('fewer than 3 → hidden, before and after the filter; a missing article row is skipped', async () => {
  const two = [{ article_id: 'a', save_count: 1 }, { article_id: 'b', save_count: 1 }]
  const { d, calls } = deps(two, [row('a'), row('b')])
  assert.deepEqual(await loadSavedThisWeek(HOUR, d), [])
  assert.equal(calls.fetch.length, 0)   // no article query for a section that can't show
  const three = [...two, { article_id: 'c', save_count: 1 }]
  assert.deepEqual(await loadSavedThisWeek(HOUR, deps(three, [row('a'), row('b', ['Equine'])]).d), [])
})

test('every failure throws (so nothing is cached): excluded ids, count, articles', async () => {
  const counts = ['a', 'b', 'c'].map((id) => ({ article_id: id, save_count: 1 }))
  const rows = [row('a'), row('b'), row('c')]
  const boom = async () => { throw new Error('boom') }
  for (const over of [{ excludedIds: boom }, { countSaves: boom }, { fetchArticles: boom }]) {
    await assert.rejects(loadSavedThisWeek(HOUR, deps(counts, rows, over).d), /boom/)
  }
})
