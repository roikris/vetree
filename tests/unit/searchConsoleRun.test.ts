// .github/workflows/scripts/search-console.js runImport() against a fake Google API and a fake Supabase client
// (analytics-001, migration 088): retries survive failures, the ledger is read in full, nothing partial is written,
// and nothing secret reaches the logs or Slack.
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
const { runImport } = require('../../.github/workflows/scripts/search-console.js')
const lib = require('../../.github/workflows/scripts/search-console-lib.js')

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const KEY = JSON.stringify({ type: 'service_account', client_email: 'r@p.iam.gserviceaccount.com', private_key: PEM, token_uri: lib.TOKEN_URI })
const TOKEN = 'ya29.TEST-ACCESS-TOKEN'
const NOW = () => new Date('2026-10-31T19:00:00Z')   // 12:00 PDT → Pacific today 2026-10-31

type Row = { day: string; status: string; final: boolean; last_error?: string | null }

// A fake Supabase client: just the calls runImport makes, with switchable failures
function fakeDb(rows: Row[] = [], opts: { failStatusUpdate?: boolean } = {}) {
  const ledger = new Map(rows.map(r => [r.day, { ...r }]))
  const rpcCalls: any[] = []
  const reads: [number, number][] = []
  const db = {
    ledger, rpcCalls, reads,
    from: () => ({
      select: () => ({
        order: () => ({
          range: async (a: number, b: number) => {
            reads.push([a, b])
            return { data: [...ledger.values()].sort((x, y) => x.day.localeCompare(y.day)).slice(a, b + 1).map(r => ({ day: r.day, status: r.status, final: r.final })), error: null }
          },
        }),
      }),
      update: (patch: Partial<Row>) => {
        const apply = (days: string[]) => {
          if (opts.failStatusUpdate && patch.status === 'failed') return { error: { code: 'XX000' } }
          for (const d of days) { const r = ledger.get(d); if (r) Object.assign(r, patch) }
          return { error: null }
        }
        return { in: async (_c: string, days: string[]) => apply(days), eq: async (_c: string, day: string) => apply([day]) }
      },
      upsert: async (list: Row[]) => { for (const r of list) if (!ledger.has(r.day)) ledger.set(r.day, { ...r }); return { error: null } },
    }),
    rpc: async (_name: string, args: any) => {
      rpcCalls.push(args)
      ledger.set(args.p_day, { day: args.p_day, status: 'ok', final: args.p_final, last_error: null })
      return { data: { daily: args.p_daily.length, queries: args.p_queries.length, pages: args.p_pages.length }, error: null }
    },
  }
  return db
}

// A fake fetch: the token endpoint, Slack, and searchAnalytics.query answered by `answer(day, dimension, startRow)`
function fakeFetch(answer: (day: string, dim: string, startRow: number) => { status?: number; body: any }) {
  const slack: string[] = []
  const calls: { day: string; dim: string; startRow: number }[] = []
  const fetch = async (url: string, init: any) => {
    if (url === lib.TOKEN_URI) return { ok: true, status: 200, json: async () => ({ access_token: TOKEN }) }
    if (url === 'https://hooks.slack.test/x') { slack.push(JSON.parse(init.body).text); return { ok: true, status: 200, json: async () => ({}) } }
    assert.match(init.headers.Authorization, /^Bearer ya29\./)
    const b = JSON.parse(init.body)
    const dim = b.dimensions[1] ?? 'totals'
    calls.push({ day: b.startDate, dim, startRow: b.startRow })
    const { status = 200, body } = answer(b.startDate, dim, b.startRow)
    return { ok: status < 300, status, json: async () => body }
  }
  return { fetch, slack, calls }
}
const okAnswer = (day: string, dim: string) => ({
  body: {
    rows: dim === 'totals' ? [{ keys: [day], clicks: 2, impressions: 50, ctr: 0.04, position: 9 }]
      : [{ keys: [day, dim === 'query' ? 'cat treats' : 'https://vetree.app/'], clicks: 1, impressions: 20, ctr: 0.05, position: 7 }],
    metadata: { firstIncompleteDate: '2026-10-29' },
  },
})
const env = (extra: Record<string, string> = {}) => ({ GSC_SERVICE_ACCOUNT_JSON: KEY, SLACK_WEBHOOK_URL: 'https://hooks.slack.test/x', ...extra })
const run = async (db: any, f: any, e = env(), logs: string[] = []) => ({ code: await runImport({ env: e, fetch: f.fetch, db, now: NOW, log: (s: string) => logs.push(s) }), logs })
const noSecrets = (lines: string[]) => {
  for (const l of lines.filter(x => !x.startsWith('::add-mask::'))) {
    assert.ok(!l.includes(TOKEN) && !l.includes('PRIVATE KEY') && !l.includes(PEM.split('\n')[1]), `secret in: ${l.slice(0, 80)}`)
  }
}

test('empty database, days=3: three days imported, final from metadata, exit 0', async () => {
  const db = fakeDb(); const f = fakeFetch(okAnswer)
  const { code, logs } = await run(db, f, env({ GSC_DAYS: '3' }))
  assert.equal(code, 0)
  assert.deepEqual(db.rpcCalls.map(c => c.p_day), ['2026-10-28', '2026-10-29', '2026-10-30'])
  assert.deepEqual(db.rpcCalls.map(c => c.p_final), [true, false, false])
  assert.equal(db.rpcCalls[0].p_pages[0].path, '/')
  noSecrets(logs)
})

test('a failure on page 2 writes nothing for that day, records it as failed, and the next run retries it', async () => {
  const full = Array.from({ length: lib.ROW_LIMIT }, (_, i) => ({ keys: ['2026-10-30', `q${i}`], clicks: 0, impressions: 1 }))
  const db = fakeDb(); const logs: string[] = []
  const f = fakeFetch((day, dim, startRow) => {
    if (day === '2026-10-30' && dim === 'query') return startRow ? { status: 500, body: { error: { status: 'INTERNAL', message: `oops ${TOKEN}` } } } : { body: { rows: full } }
    return okAnswer(day, dim)
  })
  const { code } = await run(db, f, env({ GSC_DAYS: '2' }), logs)
  assert.equal(code, 1)
  assert.deepEqual(db.rpcCalls.map(c => c.p_day), ['2026-10-29'])
  assert.equal(db.ledger.get('2026-10-30')!.status, 'failed')
  assert.match(f.slack.join('\n'), /2026-10-30: query 2026-10-30 query: HTTP 500 INTERNAL/)
  noSecrets([...logs, ...f.slack])
  const next = lib.selectDays({ todayPt: '2026-11-15', lookback: 1, importDays: [...db.ledger.values()] })
  assert.ok(next.toImport.includes('2026-10-30'))
})

test('a final day that fails re-import, with the failure write failing too, stays retryable', async () => {
  const db = fakeDb([{ day: '2026-10-30', status: 'ok', final: true }], { failStatusUpdate: true })
  const f = fakeFetch(() => ({ status: 503, body: { error: { status: 'UNAVAILABLE' } } }))
  const { code } = await run(db, f, env({ GSC_DAYS: '1' }))
  assert.equal(code, 1)
  assert.equal(db.ledger.get('2026-10-30')!.final, false, 'marked retryable before fetching')
  assert.match(f.slack.join('\n'), /recording the failure failed/)
  const later = lib.selectDays({ todayPt: '2026-12-31', lookback: 1, importDays: [...db.ledger.values()] })
  assert.ok(later.toImport.includes('2026-10-30'), 'retried long after it left the lookback')
})

test('the ledger is read in full: 1,100 final days → a default run imports only its lookback', async () => {
  const start = '2023-01-01'
  const rows = Array.from({ length: 1100 }, (_, i) => ({ day: lib.addDays('2026-10-30', -i), status: 'ok', final: true }))
  assert.ok(rows.every(r => r.day > start))
  const db = fakeDb(rows); const f = fakeFetch(okAnswer)
  const { code } = await run(db, f)
  assert.equal(code, 0)
  assert.deepEqual(db.reads, [[0, 999], [1000, 1999]])
  assert.equal(db.rpcCalls.length, 10)
})

test('a malformed rows field fails the day instead of replacing it with less', async () => {
  const db = fakeDb(); const f = fakeFetch((day, dim) => dim === 'page' ? { body: { rows: {} } } : okAnswer(day, dim))
  const { code } = await run(db, f, env({ GSC_DAYS: '1' }))
  assert.equal(code, 1)
  assert.equal(db.rpcCalls.length, 0)
  assert.match(db.ledger.get('2026-10-30')!.last_error!, /malformed rows/)
  for (const bad of [{ rows: [{ keys: ['d'], clicks: 'x', impressions: 1 }] }, { rows: [{ keys: [1, 2], clicks: 1, impressions: 1 }] }, []]) {
    assert.throws(() => lib.checkResponse('q', bad, 2), /malformed|unreadable/)
  }
  assert.deepEqual(lib.checkResponse('q', {}, 2), {}, 'no rows = an empty page')
})

test('no access (403) stops the run after the first day; a bad key never reaches the network', async () => {
  const db = fakeDb(); const f = fakeFetch(() => ({ status: 403, body: { error: { status: 'PERMISSION_DENIED', errors: [{ reason: 'forbidden' }] } } }))
  assert.equal((await run(db, f, env({ GSC_DAYS: '5' }))).code, 1)
  assert.equal(new Set(f.calls.map(c => c.day)).size, 1)
  assert.match(f.slack.join('\n'), /no access to sc-domain:vetree.app/)
  const f2 = fakeFetch(okAnswer)
  const { code, logs } = await run(fakeDb(), f2, env({ GSC_SERVICE_ACCOUNT_JSON: '{"type":"user"}' }))
  assert.equal(code, 1)
  assert.equal(f2.calls.length, 0)
  assert.match(logs.join('\n'), /not a service account key/)
})
