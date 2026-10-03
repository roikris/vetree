// Regression suite for lib/sentry/scrub.ts — every leak Codex found in the #104 review rounds,
// planted in every field the scrubber keeps. Run: npx tsx scripts/test-sentry-scrub.mts (exit 1 on failure)
import { scrubEvent, scrubBreadcrumb, scrubString } from '../lib/sentry/scrub'
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI5MGNiODI5NCJ9.c2lnbmF0dXJlc2lnbmF0dXJl'
const SB = 'base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYmMiLCJyZWZyZXNoX3Rva2VuIjoiYWJjIn0'
// HS256 JWT whose header was serialised with spaces: { "alg": "HS256", "typ": "JWT" } → eyAi…
const b64u = (o: string) => Buffer.from(o).toString('base64url')
const JWT_SPACED = b64u('{ "alg": "HS256", "typ": "JWT" }') + '.' + b64u('{ "sub": "user-1" }') + '.c2lnbmF0dXJlc2ln'
const JWT_NEWLINE = b64u('{\n"alg":"HS256"}') + '.' + b64u('{"sub":"u"}') + '.c2ln'
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
  [`cookie value ${SB}`, ['eyJhY2Nl']], ['user 90cb8294-b593-4144-a9f5-23ca52dd5e35 and roi%40gmail.com', ['90cb8294', 'roi%40']],
  ['alice@example.xn--p1ai wrote', ['alice@']],
  [`/reset/${SB}`, ['eyJhY2Nl']], [`Error.${SB}`, ['eyJhY2Nl']], [`sb-project-auth-token=${SB}`, ['eyJhY2Nl']],   // round 5
  [`token ${JWT_SPACED} end`, [JWT_SPACED.slice(0, 12)]], [`/cb/${JWT_SPACED}`, [JWT_SPACED.slice(0, 12)]], [`x=${JWT_NEWLINE}`, [JWT_NEWLINE.slice(0, 10)]],
  ['alice@example.XN--P1AI wrote', ['alice@']],
]
const plant = (x: string): any => ({
  message: x, transaction: x,
  request: { url: 'https://vetree.app' + (x.startsWith('/') || x.startsWith('#') ? x : '/p/' + x) },
  contexts: { nextjs: { request_path: x.startsWith('/') ? x : '/p/' + x, router_path: '/p/' + x } },
  exception: { values: [{ type: x, value: x, stacktrace: { frames: [{ filename: 'https://vetree.app/_next/static/chunks/' + x, function: x, context_line: x, module: x }] } }] },
  breadcrumbs: [{ category: 'navigation', data: { from: x, to: '/reset/' + x, url: x }, message: x }, { category: 'console', message: x }, { category: 'fetch', data: { url: x, method: 'GET' } }],
  debug_meta: { images: [{ debug_id: 'd', code_file: 'https://vetree.app/' + x }] },
})
let fails = 0, checks = 0
for (const [x, bad] of cases) {
  const j = JSON.stringify(scrubEvent(plant(x))); checks++
  const leak = bad.filter(b => j.includes(b)); if (leak.length) { fails++; console.log('EVENT LEAK', leak, '<-', x) }
  const b = JSON.stringify(scrubBreadcrumb({ category: 'http', message: x, data: { url: x, to: x } })); checks++
  const leak2 = bad.filter(bb => b.includes(bb)); if (leak2.length) { fails++; console.log('BREADCRUMB LEAK', leak2, '<-', x) }
}
const con = scrubBreadcrumb({ category: 'console', level: 'log', message: '[synthesis] Cache miss for: Patient Fluffy belongs to Alice Smith', data: { arguments: ['x'] }, timestamp: 1 })
const click = scrubBreadcrumb({ category: 'ui.click', message: 'button[aria-label="Synthesize evidence for Alice"]', timestamp: 1 })
console.log('console bc:', JSON.stringify(con), '| click bc:', JSON.stringify(click))
const keepEv: any = scrubEvent({ release: 'b7a52a1e0f6d8c9a1b2c3d4e5f60718293a4b5c6', exception: { values: [{ type: 'TypeError', value: 'x is undefined', stacktrace: { frames: [{ filename: 'https://vetree.app/_next/static/chunks/0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b.js', function: 'handleClick', lineno: 3 }] } }] }, debug_meta: { images: [{ debug_id: '90cb8294-b593-4144-a9f5-23ca52dd5e35', code_file: 'https://vetree.app/_next/static/chunks/0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b.js' }] } } as any)
const f = keepEv.exception.values[0].stacktrace.frames[0]
console.log('kept: chunk name', f.filename.endsWith('0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b.js'), '| image = frame', keepEv.debug_meta.images[0].code_file === f.filename, '| debug_id', keepEv.debug_meta.images[0].debug_id.startsWith('90cb'), '| release', keepEv.release.length === 40, '| value', keepEv.exception.values[0].value)
for (const k of ['Why? Because a/b is fine #1 and @vetree_app', 'Is it working? Yes.', '/article/pubmed-123 TypeError: x is undefined', 'at Object.journeyWithLongName.methodNameHere (app.js:1:2)']) if (scrubString(k) !== k) { fails++; console.log('MANGLED', k, '=>', scrubString(k)) }
for (const s of ['?'.repeat(8192), '?a'.repeat(4096), '#'.repeat(8192), 'eyJ'.repeat(2730), 'x@'.repeat(4096), '%40'.repeat(2730), ('a'.repeat(19) + '.').repeat(400), 'Basic '.repeat(1365)]) {
  const t = performance.now(); for (let k = 0; k < 5; k++) scrubString(s); const ms = (performance.now() - t) / 5; if (ms > 20) { fails++; console.log('SLOW', ms.toFixed(1), JSON.stringify(s.slice(0, 6))) }
}
console.log(fails ? `${fails} failures` : `all ${checks} event/breadcrumb leak checks, keep checks and timing checks pass`)
if (fails) process.exit(1)
