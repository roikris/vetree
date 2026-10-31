// .github/workflows/scripts/search-console-lib.js — the Search Console import's pure helpers (analytics-001, 088).
/* eslint-disable @typescript-eslint/no-require-imports */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
const lib = require('../../.github/workflows/scripts/search-console-lib.js')

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const keyJson = (over: Record<string, unknown> = {}) => JSON.stringify({
  type: 'service_account', client_email: 'reader@vetree-gsc.iam.gserviceaccount.com', private_key: pem,
  token_uri: 'https://oauth2.googleapis.com/token', private_key_id: 'abc', ...over,
})
const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString())

test('service account key: accepted shape, and errors never echo the key', () => {
  const acc = lib.parseServiceAccount(keyJson())
  assert.equal(acc.clientEmail, 'reader@vetree-gsc.iam.gserviceaccount.com')
  for (const bad of ['not json', keyJson({ type: 'user' }), keyJson({ client_email: 'x@gmail.com' }),
    keyJson({ private_key: 'nope' }), keyJson({ token_uri: 'https://evil.example/token' })]) {
    assert.throws(() => lib.parseServiceAccount(bad), (e: Error & { safe?: boolean }) => {
      assert.equal(e.safe, true)
      assert.ok(!e.message.includes('PRIVATE KEY') && !e.message.includes(pem.slice(40, 80)))
      return true
    })
  }
})

test('JWT: exact claims, one hour, no impersonation, signature verifies', () => {
  const jwt = lib.buildJwt(lib.parseServiceAccount(keyJson()), 1_800_000_000)
  const [h, c, sig] = jwt.split('.')
  assert.deepEqual(decode(h), { alg: 'RS256', typ: 'JWT' })
  assert.deepEqual(decode(c), {
    iss: 'reader@vetree-gsc.iam.gserviceaccount.com',
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: 1_800_000_000, exp: 1_800_003_600,
  })
  assert.ok(crypto.verify('RSA-SHA256', Buffer.from(`${h}.${c}`), publicKey, Buffer.from(sig, 'base64url')))
  assert.equal(lib.GRANT_TYPE, 'urn:ietf:params:oauth:grant-type:jwt-bearer')
  assert.throws(() => lib.buildJwt({ clientEmail: 'a@b.iam.gserviceaccount.com', privateKey: 'garbage' }, 1), /could not sign/)
})

test('Pacific dates, including the 2026-11-01 DST change', () => {
  assert.equal(lib.pacificDate(new Date('2026-11-01T06:59:00Z')), '2026-10-31')   // 23:59 PDT
  assert.equal(lib.pacificDate(new Date('2026-11-01T07:00:00Z')), '2026-11-01')   // 00:00 PDT
  assert.equal(lib.pacificDate(new Date('2026-11-02T07:59:00Z')), '2026-11-01')   // 23:59 PST
  assert.equal(lib.pacificDate(new Date('2026-11-02T08:00:00Z')), '2026-11-02')
  assert.equal(lib.addDays('2026-11-01', 1), '2026-11-02')
  assert.equal(lib.addDays('2026-03-01', -1), '2026-02-28')
})

test('16-month retention uses calendar months, clamped to month end', () => {
  assert.equal(lib.monthsBack('2026-03-31', 1), '2026-02-28')
  assert.equal(lib.monthsBack('2026-10-31', 16), '2025-06-30')
  assert.equal(lib.monthsBack('2028-02-29', 16), '2026-10-29')
  assert.equal(lib.monthsBack('2026-01-15', 13), '2024-12-15')
})

test('lookback input', () => {
  assert.equal(lib.parseLookback(undefined), 10)
  assert.equal(lib.parseLookback(''), 10)
  assert.equal(lib.parseLookback('30'), 30)
  for (const bad of ['0', '61', '3.5', '-1', '10; rm -rf /', 'abc']) assert.throws(() => lib.parseLookback(bad), /1\.\.60/)
})

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => lib.addDays(from, i))

test('selectDays: an empty database with days=30 imports exactly 30 days, ending yesterday', () => {
  const { toImport, toExpire } = lib.selectDays({ todayPt: '2026-10-31', lookback: 30, importDays: [] })
  assert.deepEqual(toImport, days('2026-10-01', 30))
  assert.deepEqual(toExpire, [])
})

test('selectDays: a failed day 50 days ago is retried by the next default run; gaps after the boundary are filled', () => {
  const importDays = [
    ...days('2026-09-01', 61).map((day: string) => ({ day, status: 'ok', final: true })),
  ].filter(r => r.day !== '2026-09-20' && r.day !== '2026-09-25')
  importDays.push({ day: '2026-09-11', status: 'failed', final: false })   // replaces the ok row below
  const rows = importDays.filter((r, i, a) => a.findIndex(x => x.day === r.day) === i || r.status === 'failed')
    .filter(r => !(r.day === '2026-09-11' && r.status === 'ok'))
  const { toImport } = lib.selectDays({ todayPt: '2026-10-31', lookback: 10, importDays: rows })
  assert.ok(toImport.includes('2026-09-11'), 'failed day retried')
  assert.ok(toImport.includes('2026-09-20') && toImport.includes('2026-09-25'), 'gaps filled')
  assert.ok(!toImport.includes('2026-09-12'), 'final ok days are not re-imported outside the lookback')
  assert.deepEqual(toImport.filter((d: string) => d >= '2026-10-21'), days('2026-10-21', 10))
})

test('selectDays: preliminary days are retried until final; expired days never again', () => {
  const importDays = [
    { day: '2026-10-05', status: 'ok', final: false },
    { day: '2025-01-10', status: 'failed', final: false },    // beyond the horizon (2025-06-30): expire it
    { day: '2025-01-11', status: 'expired', final: false },   // already expired: neither imported nor re-expired
  ]
  const { toImport, toExpire, horizon } = lib.selectDays({ todayPt: '2026-10-31', lookback: 3, importDays })
  assert.equal(horizon, '2025-06-30')
  assert.ok(toImport.includes('2026-10-05'))
  assert.deepEqual(toExpire, ['2025-01-10'])
  assert.ok(!toImport.some((d: string) => d < horizon))
  assert.ok(!toImport.includes('2026-10-31'), 'today is never imported')

  // gaps before the horizon are neither imported nor expired; gaps after it are filled
  assert.ok(toImport.includes('2025-06-30') && toImport.includes('2026-10-04'))
  assert.ok(!toImport.includes('2025-06-29'))
})

test('finality: every response must say complete; metadata wins over the 3-day heuristic', () => {
  const today = '2026-10-31'
  const complete = { metadata: { firstIncompleteDate: '2026-10-29' } }
  assert.equal(lib.dayFinal('2026-10-28', [complete, complete, complete], today), true)
  assert.equal(lib.dayFinal('2026-10-28', [complete, { metadata: { firstIncompleteDate: '2026-10-27' } }, complete], today), false)
  assert.equal(lib.dayFinal('2026-10-29', [complete], today), false)
  assert.equal(lib.dayFinal('2026-10-20', [{ rows: [] }, {}], today), true, 'no metadata: older than 3 days')
  assert.equal(lib.dayFinal('2026-10-29', [{ rows: [] }], today), false, 'no metadata: recent')
  assert.equal(lib.dayFinal('2026-10-20', [{ metadata: { firstIncompleteHour: '2026-10-20T14:00:00-07:00' } }], today), false)
})

test('fetchAllRows: pages until a short page; a failure on page 2 throws (so the day is never written)', async () => {
  const full = Array.from({ length: lib.ROW_LIMIT }, (_, i) => ({ keys: ['d', `q${i}`], clicks: 0, impressions: 1 }))
  const calls: number[] = []
  const r = await lib.fetchAllRows(async (startRow: number) => { calls.push(startRow); return { rows: startRow ? full.slice(0, 3) : full } })
  assert.equal(r.rows.length, lib.ROW_LIMIT + 3)
  assert.deepEqual(calls, [0, lib.ROW_LIMIT])
  assert.equal(r.truncated, false)
  await assert.rejects(lib.fetchAllRows(async (startRow: number) => {
    if (startRow) throw lib.googleError('query', 500, { error: { status: 'INTERNAL' } })
    return { rows: full }
  }), /query/)
  const capped = await lib.fetchAllRows(async () => ({ rows: full }))
  assert.equal(capped.rows.length, lib.DAILY_ROW_CAP)
  assert.equal(capped.truncated, true)
})

test('payloads: URLs that differ by query string or host stay distinct; host/path derived', () => {
  const p = lib.toPayload({
    dailyRows: [{ keys: ['2026-10-26'], clicks: 5, impressions: 100, ctr: 0.05, position: 8 }],
    queryRows: [{ keys: ['2026-10-26', 'cat treats phosphorus'], clicks: 3, impressions: 40, ctr: 0.075, position: 6 }],
    pageRows: [
      { keys: ['2026-10-26', 'https://vetree.app/article/pubmed-1'], clicks: 1, impressions: 9, ctr: 0.1, position: 4 },
      { keys: ['2026-10-26', 'https://vetree.app/article/pubmed-1?utm=x'], clicks: 0, impressions: 2, ctr: 0, position: 9 },
      { keys: ['2026-10-26', 'https://WWW.vetree.app/'], clicks: 0, impressions: 1, ctr: 0, position: 20 },
    ],
  })
  assert.deepEqual(p.daily, [{ clicks: 5, impressions: 100, ctr: 0.05, position: 8 }])
  assert.equal(p.queries[0].query, 'cat treats phosphorus')
  assert.equal(new Set(p.pages.map((x: { page_url: string }) => x.page_url)).size, 3)
  assert.deepEqual(p.pages.map((x: { host: string; path: string }) => `${x.host}${x.path}`),
    ['vetree.app/article/pubmed-1', 'vetree.app/article/pubmed-1', 'www.vetree.app/'])
})

test('errors: status and Google reason only — never a body, key or token', () => {
  const e = lib.googleError('query 2026-10-26 page', 403, {
    error: { status: 'PERMISSION_DENIED', message: 'User reader@x does not have access; token ya29.SECRET', errors: [{ reason: 'forbidden' }] },
  })
  const s = lib.sanitizedError(e)
  assert.match(s, /^query 2026-10-26 page: HTTP 403 PERMISSION_DENIED forbidden \(no access to sc-domain:vetree.app/)
  assert.ok(!s.includes('ya29') && !s.includes('reader@x'))
  assert.equal(lib.sanitizedError(new Error('ya29.SECRET leaked')), 'unexpected error (details withheld)')
  assert.ok(lib.sanitizedError(lib.googleError('x', 500, { error: { status: 'a'.repeat(500) } })).length <= 200)
})
