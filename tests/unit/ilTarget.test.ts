// lib/growth/ilTarget.ts — where vetree.app/il sends the reader. The database and the limiter are fakes: no network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveIlPath, latestPostedArticleId, type IlClient } from '../../lib/growth/ilTarget'

type Call = [string, ...unknown[]]
type Answer = { data: { article_id?: string | null; id?: string } | null; error: { code?: string } | null }

// A recording stand-in for the Supabase query builder: every call is logged per table, maybeSingle() answers
function fakeDb(answers: Record<string, Answer>) {
  const calls: Record<string, Call[]> = {}
  const db: IlClient = {
    from(table: string) {
      const log: Call[] = (calls[table] = [])
      const chain = {
        eq: (...a: unknown[]) => (log.push(['eq', ...a]), chain),
        not: (...a: unknown[]) => (log.push(['not', ...a]), chain),
        or: (...a: unknown[]) => (log.push(['or', ...a]), chain),
        order: (...a: unknown[]) => (log.push(['order', ...a]), chain),
        limit: (...a: unknown[]) => (log.push(['limit', ...a]), chain),
        maybeSingle: () => Promise.resolve(answers[table] ?? { data: null, error: null }),
      }
      return { select: (cols: string) => (log.push(['select', cols]), chain) }
    },
  }
  return { db, calls }
}

const allow = () => Promise.resolve({ success: true })
const deps = (db: IlClient, extra: Partial<Parameters<typeof resolveIlPath>[0]> = {}) => {
  const reported: unknown[] = []
  return { reported, d: { limit: allow, db: () => db, report: (e: unknown) => reported.push(e), ...extra } }
}

test('the latest posted row on ANY platform — no platform filter, newest first, one row', async () => {
  const { db, calls } = fakeDb({ growth_agent_memory: { data: { article_id: 'pubmed-1' }, error: null } })
  assert.equal(await latestPostedArticleId(db), 'pubmed-1')
  assert.deepEqual(calls.growth_agent_memory, [
    ['select', 'article_id'],
    ['eq', 'outcome', 'approved'],
    ['not', 'article_id', 'is', null],
    ['order', 'created_at', { ascending: false }],
    ['limit', 1],
  ])
})

test('a visible article → its page', async () => {
  const { db, calls } = fakeDb({
    growth_agent_memory: { data: { article_id: 'pubmed-42806282' }, error: null },
    articles: { data: { id: 'pubmed-42806282' }, error: null },
  })
  const { d } = deps(db)
  assert.equal(await resolveIlPath(d), '/article/pubmed-42806282')
  // the Public Article Filter, exactly
  assert.deepEqual(calls.articles, [
    ['select', 'id'],
    ['eq', 'id', 'pubmed-42806282'],
    ['eq', 'needs_enrichment', false],
    ['not', 'summary', 'is', null],
    ['not', 'clinical_bottom_line', 'is', null],
    ['or', 'quarantined.is.null,quarantined.eq.false'],
  ])
})

test('the id is URL-encoded', async () => {
  const { db } = fakeDb({
    growth_agent_memory: { data: { article_id: 'a b/c' }, error: null },
    articles: { data: { id: 'a b/c' }, error: null },
  })
  assert.equal(await resolveIlPath(deps(db).d), '/article/a%20b%2Fc')
})

test('a hidden article (fails the public filter) → home', async () => {
  const { db } = fakeDb({ growth_agent_memory: { data: { article_id: 'pubmed-9' }, error: null }, articles: { data: null, error: null } })
  assert.equal(await resolveIlPath(deps(db).d), '/')
})

test('nothing posted yet → home, nothing reported', async () => {
  const { db } = fakeDb({ growth_agent_memory: { data: null, error: null } })
  const { d, reported } = deps(db)
  assert.equal(await resolveIlPath(d), '/')
  assert.equal(reported.length, 0)
})

test('rate-limited → home, the database is never read', async () => {
  let read = false
  const { d } = deps({ from: () => { read = true; throw new Error('must not read') } } as IlClient,
    { limit: () => Promise.resolve({ success: false }) })
  assert.equal(await resolveIlPath(d), '/')
  assert.equal(read, false)
})

test('a limiter outage → home, reported', async () => {
  const { db } = fakeDb({})
  const { d, reported } = deps(db, { limit: () => Promise.reject(new Error('redis down')) })
  assert.equal(await resolveIlPath(d), '/')
  assert.equal(reported.length, 1)
})

test('a read error on either table → home, reported (code only, no data)', async () => {
  for (const answers of <Record<string, Answer>[]>[
    { growth_agent_memory: { data: null, error: { code: '42501' } } },
    { growth_agent_memory: { data: { article_id: 'pubmed-1' }, error: null }, articles: { data: null, error: { code: '57014' } } },
  ]) {
    const { db } = fakeDb(answers)
    const { d, reported } = deps(db)
    assert.equal(await resolveIlPath(d), '/')
    assert.equal(reported.length, 1)
    assert.match(String(reported[0]), /read failed \((42501|57014)\)/)
  }
})
