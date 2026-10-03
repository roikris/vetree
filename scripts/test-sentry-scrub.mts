/* eslint-disable @typescript-eslint/no-explicit-any -- synthetic Sentry events are free-form */
// Regression suite for lib/sentry/scrub.ts — every leak found in the PR #104 Codex review rounds,
// planted in every field the scrubber keeps, plus what must be dropped and what must survive.
// Run: npx tsx scripts/test-sentry-scrub.mts   (exits 1 on any failure)
import { scrubEvent, scrubBreadcrumb, scrubString, routeShape } from '../lib/sentry/scrub'

let failures = 0
const fail = (msg: string) => { failures++; console.log('FAIL', msg) }
const expect = (cond: boolean, msg: string) => { if (!cond) fail(msg) }

const b64u = (o: string) => Buffer.from(o).toString('base64url')
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI5MGNiODI5NCJ9.c2lnbmF0dXJlc2lnbmF0dXJl'
const JWT_SPACED = b64u('{ "alg": "HS256", "typ": "JWT" }') + '.' + b64u('{ "sub": "user-1" }') + '.c2lnbmF0dXJlc2ln'
const JWT_NEWLINE = b64u('{\n"alg":"HS256"}') + '.' + b64u('{"sub":"u"}') + '.c2ln'
const JWT_LEADING_SPACE = b64u(' {"alg":"HS256","typ":"JWT"}') + '.' + b64u(' {"sub":"synthetic-user"}') + '.c2lnbmF0dXJl'
const SB = 'base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYmMiLCJyZWZyZXNoX3Rva2VuIjoiYWJjIn0'
const OPAQUE = 'AbCdEfGhIjKlMnOpQrStUvWxYz01234567890123456789'
const UUIDV = '90cb8294-b593-4144-a9f5-23ca52dd5e35'

// [input, substrings that must not survive anywhere]
const cases: [string, string[]][] = [
  ['https://example.test/?email=synthetic@example.test&token=SECRET', ['SECRET', 'synthetic@']],
  ['/users/synthetic@example.test?code=SECRET', ['SECRET', 'synthetic@']],
  ['#/callback?access_token=SECRET', ['SECRET']], ['#access_token=SECRET', ['SECRET']],
  ['url=/auth/callback?code=SECRET', ['SECRET']], ['/auth?token=aaa,SECRET', ['SECRET']],
  ['https://example.test/?filter=in.(one,SECRET)', ['SECRET']],
  ['https://example.test/callback?flag&code=short-secret', ['short-secret']],
  ['https://example.test/callback?api+key=short-secret', ['short-secret']],
  [`token=${JWT}`, ['eyJhbGci']], [`Error.${JWT}`, ['eyJhbGci']], [`/reset/${JWT}`, ['eyJhbGci']],
  ['Authorization: Basic dTpw', ['dTpw']], [`console said ${JWT} ok`, ['eyJhbGci']],
  [`cookie value ${SB}`, ['eyJhY2Nl']], [`/reset/${SB}`, ['eyJhY2Nl']], [`Error.${SB}`, ['eyJhY2Nl']],
  [`sb-project-auth-token=${SB}`, ['eyJhY2Nl']],
  [`user ${UUIDV} and roi%40gmail.com`, ['90cb8294', 'roi']],
  ['alice@example.xn--p1ai wrote', ['alice@']], ['alice@example.XN--P1AI wrote', ['alice@']],
  [`token ${JWT_SPACED} end`, [JWT_SPACED.slice(0, 12)]], [`/cb/${JWT_SPACED}`, [JWT_SPACED.slice(0, 12)]],
  [`x=${JWT_NEWLINE}`, [JWT_NEWLINE.slice(0, 10)]],
  [`jwt ${JWT_LEADING_SPACE}`, [JWT_LEADING_SPACE.slice(0, 12)]],                         // round 6
  [`/reset/${OPAQUE}`, [OPAQUE.slice(0, 16)]], [`https://vetree.app/reset/${OPAQUE}`, [OPAQUE.slice(0, 16)]],
  ['synthetic@例え.テスト', ['synthetic']], ['synthetic%40example%2Etest', ['synthetic']],
  [`/users/user_${UUIDV}`, ['90cb8294']],
]

const plant = (x: string): any => ({
  message: x, transaction: `GET ${x}`, fingerprint: [x],
  request: { url: 'https://vetree.app' + (x.startsWith('/') || x.startsWith('#') ? x : '/p/' + x), method: 'GET' },
  contexts: {
    nextjs: { request_path: x.startsWith('/') ? x : '/p/' + x, router_path: '/p/' + x },
    os: { name: x }, browser: { name: x, version: x }, response: { body: x }, custom: { v: x },
  },
  exception: { values: [{
    type: x, value: x, mechanism: { type: x, data: { x } },
    stacktrace: { frames: [{ filename: 'https://vetree.app/_next/static/chunks/' + x, abs_path: x, function: x, module: x,
      context_line: x, pre_context: [x], post_context: [x], vars: { x } }] },
  }] },
  breadcrumbs: [
    { category: 'navigation', data: { from: x, to: '/reset/' + x, url: x }, message: x },
    { category: 'console', message: x, data: { arguments: [x] } },
    { category: 'ui.click', message: `button[aria-label="${x}"]` },
    { category: 'fetch', data: { url: x, method: 'GET', body: x } },
  ],
  debug_meta: { images: [{ debug_id: 'd', code_file: 'https://vetree.app/' + x }] },
  extra: { [x]: x }, tags: { [x]: x }, user: { id: x, email: x, ip_address: x },
})

for (const [x, bad] of cases) {
  const ev = JSON.stringify(scrubEvent(plant(x)))
  const bc = JSON.stringify(scrubBreadcrumb({ category: 'http', message: x, data: { url: x, to: x, from: x } }))
  for (const b of bad) {
    if (ev.includes(b)) fail(`event leaks ${JSON.stringify(b)} from ${JSON.stringify(x)}`)
    if (bc.includes(b)) fail(`breadcrumb leaks ${JSON.stringify(b)} from ${JSON.stringify(x)}`)
  }
}

// Dropped whole
const dropped: any = scrubEvent(plant('SECRET-X'))
expect(!('extra' in dropped) && !('tags' in dropped) && !('user' in dropped), 'extra/tags/user dropped')
expect(!('response' in dropped.contexts) && !('custom' in dropped.contexts), 'response/custom contexts dropped')
expect(!('vars' in dropped.exception.values[0].stacktrace.frames[0]), 'frame vars dropped')
expect(!('data' in dropped.exception.values[0].mechanism), 'mechanism.data dropped')
expect(JSON.stringify(scrubBreadcrumb({ category: 'console', level: 'log', message: 'Patient Fluffy belongs to Alice', timestamp: 1 })) === '{"category":"console","level":"log","timestamp":1}', 'console breadcrumb reduced to category')
expect(JSON.stringify(scrubBreadcrumb({ category: 'ui.click', message: 'button[aria-label="Alice"]', timestamp: 1 })) === '{"category":"ui.click","timestamp":1}', 'ui breadcrumb reduced to category')
expect(!JSON.stringify(scrubBreadcrumb({ category: 'fetch', data: { url: '/x', body: 'pw', 'http.query': 'q' } })).includes('pw'), 'unknown breadcrumb data dropped')

// Must survive
const CHUNK = 'https://vetree.app/_next/static/chunks/0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b.js'
const keep: any = scrubEvent({
  release: 'b7a52a1e0f6d8c9a1b2c3d4e5f60718293a4b5c6', environment: 'production',
  exception: { values: [{ type: 'TypeError', value: 'x is undefined', mechanism: { type: 'onerror', handled: false },
    stacktrace: { frames: [{ filename: CHUNK, function: 'handleClick', lineno: 3, colno: 7, in_app: true }] } }] },
  debug_meta: { images: [{ type: 'sourcemap', debug_id: UUIDV, code_file: CHUNK }] },
  contexts: { browser: { name: 'Chrome', version: '128' }, nextjs: { router_path: '/article/[id]', request_path: '/article/pubmed-123' } },
} as any)
const frame = keep.exception.values[0].stacktrace.frames[0]
expect(frame.filename === CHUNK, 'chunk file name kept')
expect(keep.debug_meta.images[0].code_file === CHUNK && keep.debug_meta.images[0].debug_id === UUIDV, 'debug image kept and matches frame')
expect(keep.release.length === 40 && keep.environment === 'production', 'release/environment kept')
expect(frame.function === 'handleClick' && frame.lineno === 3 && keep.exception.values[0].value === 'x is undefined', 'frame + message kept')
expect(keep.contexts.browser.name === 'Chrome' && keep.contexts.nextjs.router_path === '/article/[id]', 'browser/router contexts kept')
expect(keep.contexts.nextjs.request_path === '/article/:id', 'request path reduced to route shape')
expect(routeShape('https://user:pw@vetree.app/api/v1/followed_tags?x=1') === 'https://vetree.app/api/v1/followed_tags', 'route shape keeps words, drops userinfo/query')
for (const k of ['Why? Because a/b is fine #1 and @vetree_app', 'Is it working? Yes.', 'TypeError: x is undefined',
  'at Object.journeyWithLongName.methodNameHere (app.js:1:2)']) expect(scrubString(k) === k, `ordinary text unchanged: ${k}`)

// Timing: warm up, then the median of 7 runs per adversarial input must stay under 50 ms
for (const s of ['?'.repeat(8192), '?a'.repeat(4096), '#'.repeat(8192), 'eyJ'.repeat(2730), 'x@'.repeat(4096),
  '%40'.repeat(2730), ('a'.repeat(19) + '.').repeat(400), 'Basic '.repeat(1365), 'é@'.repeat(4096), ('ab'.repeat(20) + '/').repeat(195)]) {
  for (let k = 0; k < 3; k++) scrubString(s)
  const times = Array.from({ length: 7 }, () => { const t = performance.now(); scrubString(s); return performance.now() - t }).sort((a, b) => a - b)
  if (times[3] > 50) fail(`slow: median ${times[3].toFixed(1)} ms on ${JSON.stringify(s.slice(0, 8))}`)
}

console.log(failures ? `${failures} failure(s)` : `all checks pass (${cases.length} leak cases × event + breadcrumb, drop/keep and timing checks)`)
if (failures) process.exit(1)
