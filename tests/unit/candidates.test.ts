// lib/growth/candidates.ts — rankGrowthCandidates end to end on a fake database (growth-003).
// The fake ignores filters: each table returns the rows given, so tests supply rows that already pass them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { rankGrowthCandidates, CROWD_FAVORITE_MIN_CLICKS } from '../../lib/growth/candidates'

type Rows = Record<string, unknown[]>

function fakeDb(rows: Rows, failing?: string) {
  return {
    from(table: string) {
      const result = failing === table
        ? { data: null, error: { message: `${table} unavailable` } }
        : { data: rows[table] ?? [], error: null }
      const builder: object = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad)
          return () => builder
        },
      })
      return builder
    },
  } as unknown as SupabaseClient
}

const NOW = Date.parse('2026-10-21T09:00:00Z')                // 12:00 in Israel
const article = (id: string, extra: Record<string, unknown> = {}) => ({
  id, title: `Article ${id}`, clinical_bottom_line: 'x', labels: ['Small Animal'], source_journal: 'J',
  publication_date: '2026-10-01', strength_of_evidence: null, created_at: '2026-10-15T00:00:00Z', ...extra,
})
const memory = (article_id: string, outcome: string, created_at: string) => ({ article_id, outcome, created_at })
const shown = (date: string, ...ids: string[]) => ({ served_at: `${date}T09:00:00Z`, items: ids.map(article_id => ({ article_id })) })
const ids = (r: { ranked: { id: string }[] }) => r.ranked.map(c => c.id).sort()

test('passed over on 3 earlier days → left out and counted; 2 days → still in', async () => {
  const db = fakeDb({
    articles: [article('a'), article('b')],
    growth_recommendation_sets: [shown('2026-10-18', 'a', 'b'), shown('2026-10-19', 'a', 'b'), shown('2026-10-20', 'a')],
  })
  const r = await rankGrowthCandidates(db, { now: NOW })
  assert.deepEqual(ids(r), ['b'])
  assert.equal(r.restingCount, 1)
})

test('resting counts only articles that were otherwise eligible', async () => {
  const sets = [shown('2026-10-18', 'a'), shown('2026-10-19', 'a'), shown('2026-10-20', 'a')]
  const dismissed = await rankGrowthCandidates(fakeDb({
    articles: [article('a')], growth_recommendation_sets: sets,
    growth_agent_memory: [memory('a', 'irrelevant', '2026-10-20T10:00:00Z')],
  }), { now: NOW })
  assert.equal(dismissed.restingCount, 0)
  const exotic = await rankGrowthCandidates(fakeDb({
    articles: [article('a', { labels: ['Small Animal', 'Exotic'] })], growth_recommendation_sets: sets,
  }), { now: NOW })
  assert.equal(exotic.restingCount, 0)
})

test('a resting crowd favorite stays out too', async () => {
  const clicks = Array.from({ length: CROWD_FAVORITE_MIN_CLICKS }, () => ({ path: '/article/f', created_at: '2026-01-01T00:00:00Z' }))
  const base = { articles: [article('f')], page_views: clicks }
  const free = await rankGrowthCandidates(fakeDb(base), { now: NOW })
  assert.equal(free.ranked[0]?.crowdFavorite, true)
  const resting = await rankGrowthCandidates(fakeDb({
    ...base, growth_recommendation_sets: [shown('2026-10-18', 'f'), shown('2026-10-19', 'f'), shown('2026-10-20', 'f')],
  }), { now: NOW })
  assert.deepEqual(ids(resting), [])
  assert.equal(resting.restingCount, 1)
})

test('a skip rests 7 days, independent of showings', async () => {
  const db = (at: string) => fakeDb({ articles: [article('s')], growth_agent_memory: [memory('s', 'skipped', at)] })
  assert.deepEqual(ids(await rankGrowthCandidates(db('2026-10-15T09:00:00Z'), { now: NOW })), [])
  assert.deepEqual(ids(await rankGrowthCandidates(db('2026-10-13T09:00:00Z'), { now: NOW })), ['s'])
})

test('"today" is the Israel day: yesterday evening is not today after Israel midnight', async () => {
  // 2026-10-21 00:30 Israel = 2026-10-20 21:30 UTC. Yesterday 20:00 Israel = 17:00 UTC.
  const now = Date.parse('2026-10-20T21:30:00Z')
  // an outcome with no rule of its own, so only "touched today" can exclude it
  const touched = (at: string) => fakeDb({ articles: [article('t')], growth_agent_memory: [memory('t', 'regenerated', at)] })
  assert.deepEqual(ids(await rankGrowthCandidates(touched('2026-10-20T17:00:00Z'), { now })), ['t'])  // yesterday
  assert.deepEqual(ids(await rankGrowthCandidates(touched('2026-10-20T21:10:00Z'), { now })), [])     // 00:10 today
})

test('a failed read of recommendation history throws — never "nothing resting"', async () => {
  await assert.rejects(
    rankGrowthCandidates(fakeDb({ articles: [article('a')] }, 'growth_recommendation_sets'), { now: NOW }),
    /recommendation sets: growth_recommendation_sets unavailable/,
  )
})
