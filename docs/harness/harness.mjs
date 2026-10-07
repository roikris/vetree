// JSON helpers for docs/harness/init.sh. Plain Node (no dependencies), so init.sh stays bash-3.2
// compatible. Every command prints a short human line and exits 0 (ok) or non-zero (problem).
//
//   node docs/harness/harness.mjs stamp <repoRoot>
//   node docs/harness/harness.mjs lint-baseline <eslint.json> <repoRoot> <out.json>
//   node docs/harness/harness.mjs lint-compare <eslint.json> <repoRoot> <baseline.json> <sigs.json>
//   node docs/harness/harness.mjs signatures <tsc|build> <log> <sigs.json>
//   node docs/harness/harness.mjs classify <sigsDir> <feature_list.json> <itemId> <headSha>
//   node docs/harness/harness.mjs vercel-ok <vercel.json>
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const [cmd, ...args] = process.argv.slice(2)

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n')
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

// Install fingerprint: lockfile + .npmrc contents + node and npm versions.
function stamp(root) {
  const h = createHash('sha256')
  for (const f of ['package-lock.json', '.npmrc']) {
    const p = join(root, f)
    h.update(f + '\0' + (existsSync(p) ? readFileSync(p) : '') + '\0')
  }
  const npm = execFileSync('npm', ['-v'], { encoding: 'utf8' }).trim()
  h.update(process.version + '\0' + npm)
  console.log(h.digest('hex'))
}

// ESLint JSON → { "file\trule": count } for errors only (severity 2). Warnings never fail.
function lintCounts(eslintJson, root) {
  const counts = {}
  for (const r of readJson(eslintJson)) {
    const file = relative(root, r.filePath)
    for (const m of r.messages) {
      if (m.severity !== 2) continue
      const key = file + '\t' + (m.ruleId ?? 'parse-error')
      counts[key] = (counts[key] ?? 0) + 1
    }
  }
  return counts
}

function lintBaseline(eslintJson, root, out) {
  const counts = lintCounts(eslintJson, root)
  const entries = Object.keys(counts).sort().map((k) => {
    const [file, rule] = k.split('\t')
    return { file, rule, count: counts[k] }
  })
  const total = entries.reduce((n, e) => n + e.count, 0)
  writeJson(out, {
    note: 'Known lint errors (D9 ratchet). Only errors above these counts fail. Shrink, never grow.',
    total_errors: total,
    entries,
  })
  console.log(`lint baseline written: ${total} errors in ${entries.length} file+rule entries`)
}

// Fails on any file+rule above its baseline count; reports entries that shrank.
// Exit 0 = no new errors, 1 = new errors (signatures written), 2 = could not compare (unparsed).
function lintCompare(eslintJson, root, baselinePath, sigsOut) {
  let now
  try { now = lintCounts(eslintJson, root) } catch (e) {
    writeJson(sigsOut, { check: 'lint', unparsed: true, failures: [] })
    console.log(`  lint: could not read ESLint JSON (${e.message}) — UNPARSED`)
    process.exit(2)
  }
  const base = {}
  for (const e of readJson(baselinePath).entries) base[e.file + '\t' + e.rule] = e.count
  const over = []
  const shrunk = []
  for (const [k, n] of Object.entries(now)) if (n > (base[k] ?? 0)) over.push([k, n, base[k] ?? 0])
  for (const [k, n] of Object.entries(base)) if ((now[k] ?? 0) < n) shrunk.push([k, now[k] ?? 0, n])
  const sigs = over.map(([k]) => {
    const [file, rule] = k.split('\t')
    return { check: 'lint', file, code: rule, message: null }
  })
  writeJson(sigsOut, { check: 'lint', unparsed: false, failures: sigs })
  for (const [k, n, b] of over) console.log(`  NEW lint error(s): ${k.replace('\t', ' · ')} — ${n} (baseline ${b})`)
  if (shrunk.length) {
    console.log(`  ${shrunk.length} baseline entr${shrunk.length === 1 ? 'y' : 'ies'} shrank — ` +
      'regenerate with `docs/harness/init.sh --write-lint-baseline` in the PR that fixed them')
  }
  process.exit(over.length ? 1 : 0)
}

// tsc — the only log that can EXPLAIN a WIP failure. Strict, fail-closed: a line is a diagnostic
// (`file(l,c): error TSxxxx: msg` or global `error TSxxxx: msg`) or an indented continuation,
// which is APPENDED to the diagnostic above it — extra indented text changes that signature, so it
// can never be accepted silently. Anything else (a stray line, a continuation with nothing above it,
// a stack trace start) → unparsed.
//
// build — INFORMATIONAL only (D8 design, Codex step-9 rounds 1–3): build logs are open-ended, so a
// build failure is never matched against expected_failures. Its signatures are for the report;
// `classify` rejects any failed build. Line/column numbers are never part of a signature.
function signatures(check, log, out) {
  // Strip ANSI colour codes.
  const raw = existsSync(log) ? readFileSync(log, 'utf8').replace(/\x1b\[[0-9;]*m/g, '') : ''
  const lines = raw.split('\n')
  const failures = []
  let unknown = false
  let cur = null
  for (const line of lines) {
    const l = line.trimEnd()
    const ts = l.match(/^(\S.*?)\(\d+,\d+\): error (TS\d+): (.*)$/)
    const gts = l.match(/^error (TS\d+): (.*)$/)
    if (ts || gts) {
      cur = ts ? { check, file: ts[1], code: ts[2], message: norm(ts[3]) }
               : { check, file: null, code: gts[1], message: norm(gts[2]) }
      failures.push(cur)
    } else if (check === 'tsc') {
      if (!l.trim()) cur = null
      else if (/^\s/.test(l) && cur) cur.message = norm(cur.message + ' ' + l)
      else unknown = true
    } else {
      const m = l.match(/^\.?\/?((?:[\w@[\]().-]+\/)*[\w@[\]().-]+\.[A-Za-z]+):\d+:\d+\s*$/)
      if (m) cur = { check, file: m[1], code: 'build', message: '' }
      else if (cur && !cur.message && /^(Error|Type error):/.test(l.trim())) {
        cur.message = norm(l.trim()); failures.push(cur); cur = null
      }
    }
  }
  const unparsed = check === 'tsc' ? unknown || failures.length === 0 : true
  writeJson(out, { check, unparsed, failures })
  console.log(`${check}: ${failures.length} failure signature(s)${unparsed ? (check === 'tsc' ? ' — UNPARSED' : ' (build: informational only)') : ''}`)
}

const same = (a, b) => a.check === b.check && (a.file ?? null) === (b.file ?? null) &&
  (a.code ?? null) === (b.code ?? null) &&
  (a.check === 'lint' || norm(a.message) === norm(b.message))

// Exit 0: every failure matches the item's recorded WIP (HEAD == wip_sha). Exit 1: anything else.
// Fail-closed: every check listed in failed-checks must have a parsed, non-empty signature file.
function classify(sigsDir, featureList, itemId, headSha) {
  const failedPath = join(sigsDir, 'failed-checks')
  const failed = existsSync(failedPath) ? readFileSync(failedPath, 'utf8').split('\n').filter(Boolean) : []
  if (!failed.length) { console.log('REGRESSION: no record of which checks failed — no evidence to match'); process.exit(1) }
  const results = []
  if (failed.includes('acl')) {
    console.log('REGRESSION: the access-control audit failed — never an expected WIP failure')
    process.exit(1)
  }
  if (failed.includes('build')) {
    console.log('REGRESSION: the build failed — a build failure is never an expected WIP failure ' +
      '(on the recorded WIP commit the build is skipped; tsc + lint decide)')
    process.exit(1)
  }
  for (const check of failed) {
    const p = join(sigsDir, check + '.sigs.json')
    let r = null
    try { r = existsSync(p) ? readJson(p) : null } catch { r = null }
    if (!r || r.unparsed || !Array.isArray(r.failures) || !r.failures.length) {
      console.log(`REGRESSION: ${check} failed but left no parsed failure signatures — never counts as expected`)
      process.exit(1)
    }
    results.push(r)
  }
  const item = (readJson(featureList).features ?? []).find((f) => f.id === itemId)
  if (!item) { console.log(`REGRESSION: item ${itemId} not in feature_list.json`); process.exit(1) }
  if (!item.wip_sha || item.wip_sha !== headSha) {
    console.log(`REGRESSION: HEAD ${headSha.slice(0, 7)} is not the item's recorded wip_sha (${item.wip_sha ?? 'none'})`)
    process.exit(1)
  }
  const expected = item.expected_failures ?? []
  const unmatched = results.flatMap((r) => r.failures).filter((f) => !expected.some((e) => same(f, e)))
  if (unmatched.length) {
    console.log(`REGRESSION: ${unmatched.length} failure(s) not in the item's expected_failures:`)
    for (const u of unmatched) console.log(`  ${u.check} · ${u.file ?? '-'} · ${u.code ?? '-'} · ${u.message ?? ''}`)
    process.exit(1)
  }
  console.log(`EXPECTED-WIP: all failures match ${itemId}'s recorded WIP — continue the item`)
}

function vercelOk(p) {
  let ok = false
  try { ok = readJson(p)?.git?.deploymentEnabled === false } catch { ok = false }
  console.log(ok ? 'vercel.json: deployments disabled' : 'vercel.json: MISSING or deploymentEnabled is not false')
  process.exit(ok ? 0 : 1)
}


// ---------------------------------------------------------------- access-control audit (infra-001)
// Compares PostgreSQL's ACTUAL privileges (public.harness_acl_report(), migration 074) with the
// checked-in expectation supabase/access.json, exactly. Exit 0 = match, 1 = mismatch, 2 = unverified
// (the report could not be fetched or is malformed) — never a pass. Errors are sanitized: only HTTP
// status and error codes are printed, never keys, headers or raw responses.
const ACL_ROLES = ['anon', 'authenticated', 'service_role', 'PUBLIC']
const ACL_FILE = 'supabase/access.json'
// Only these count as "network" (→ possibly transient); any other fetch failure is a setup error.
const NETWORK_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH',
  'EHOSTUNREACH', 'EPIPE', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET', 'UND_ERR_CLOSED'])
// PostgreSQL's relation / sequence privileges — an explicit allow-list (MAINTAIN is PostgreSQL 17+)
const PRIV_SET = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'USAGE', 'MAINTAIN'])
const isPriv = p => typeof p === 'string' && PRIV_SET.has(p)
const DEFAULT_KINDS = new Set(['default:tables', 'default:sequences'])
const KINDS = new Set(['table', 'partitioned table', 'view', 'materialized view', 'sequence', 'foreign table'])
// Diagnostics never echo response content: names are shown only when they look like plain identifiers.
const safeName = n => (typeof n === 'string' && /^public\.[A-Za-z0-9_]{1,63}$/.test(n) ? n : '<unprintable name>')

async function fetchAclReport() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { error: 'missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }
  let res
  try {
    res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/harness_acl_report`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
  } catch (e) {
    const code = String(e?.cause?.code || '')
    if (NETWORK_CODES.has(code)) return { error: `network: ${code}`, network: true }
    return { error: `fetch failed (${/^[A-Z_]{2,40}$/.test(code) ? code : 'setup error'})` }
  }
  let body = null
  try { body = await res.json() } catch { body = null }
  const code = body && typeof body.code === 'string' && /^[A-Z0-9]{2,12}$/.test(body.code) ? ` (${body.code})` : ''
  if (!res.ok) return { error: `HTTP ${res.status}${code}` }
  if (!Array.isArray(body)) return { error: 'report is not an array' }
  return { rows: body }
}

// rows → { objects: { name: { kind, anon: [...], ... } }, defaults: [...] } or { malformed: [...] }
function parseAclReport(rows) {
  const objects = {}, seen = {}, defaults = [], malformed = []
  if (!Array.isArray(rows)) return { objects, defaults, malformed: ['report is not an array'] }
  rows.forEach((r, i) => {
    if (!r || typeof r.object !== 'string' || typeof r.kind !== 'string' || typeof r.grantee !== 'string' ||
        !Array.isArray(r.privileges) || !r.privileges.every(isPriv)) {
      malformed.push(`row ${i + 1}: not {object, kind, grantee, privileges[]} with privilege names`); return
    }
    if (DEFAULT_KINDS.has(r.kind)) { defaults.push(r); return }
    if (!KINDS.has(r.kind)) { malformed.push(`${safeName(r.object)}: unknown kind`); return }
    if (!/^public\.[^\s]{1,63}$/.test(r.object)) { malformed.push(`row ${i + 1}: object is not a public relation name`); return }
    if (!ACL_ROLES.includes(r.grantee)) { malformed.push(`${safeName(r.object)}: unexpected grantee`); return }
    const o = objects[r.object] ??= { kind: r.kind }
    if (o.kind !== r.kind) malformed.push(`${safeName(r.object)}: two kinds`)
    seen[r.object] ??= new Set()
    if (seen[r.object].has(r.grantee)) malformed.push(`${safeName(r.object)}: duplicate row for ${r.grantee}`)
    seen[r.object].add(r.grantee)
    o[r.grantee] = [...new Set(r.privileges)].sort()
  })
  for (const [name, set] of Object.entries(seen)) {
    const missing = ACL_ROLES.filter(g => !set.has(g))
    if (missing.length) malformed.push(`${safeName(name)}: no row for ${missing.join(', ')} (every relation must have exactly 4)`)
  }
  return { objects, defaults, malformed }
}

function compareAcl(actual, expected) {
  const diffs = []
  for (const name of Object.keys(actual).sort()) {
    const a = actual[name], e = expected[name], n = safeName(name)
    if (!e) { diffs.push(`NEW   ${n} (${a.kind}) is not in ${ACL_FILE} — add it with its intended grants, and grant them in the migration`); continue }
    if (e.kind !== a.kind) diffs.push(`KIND  ${n}: expected ${e.kind}, is ${a.kind}`)
    for (const g of ACL_ROLES) {
      const want = [...new Set(e[g])].sort(), have = a[g]
      const extra = have.filter(x => !want.includes(x)), lack = want.filter(x => !have.includes(x))
      if (extra.length || lack.length) diffs.push(`ACL   ${n} · ${g}: ${extra.length ? `+${extra.join(',+')} ` : ''}${lack.length ? `-${lack.join(',-')}` : ''}`.trim())
    }
  }
  for (const name of Object.keys(expected).sort()) if (!actual[name]) diffs.push(`GONE  ${safeName(name)} is in ${ACL_FILE} but not in the database (dropped, renamed, or migration not pushed)`)
  return diffs
}

// The expectation file: every entry has a known kind and ALL four roles as explicit arrays ([] = none).
function readExpected(path) {
  let j
  try { j = readJson(path) } catch { throw new Error(`${path}: not readable JSON`) }
  if (!j || typeof j.objects !== 'object' || j.objects === null || Array.isArray(j.objects)) throw new Error(`${path}: missing "objects"`)
  for (const [name, e] of Object.entries(j.objects)) {
    if (!e || !KINDS.has(e.kind)) throw new Error(`${path}: ${safeName(name)} has no valid kind`)
    for (const g of ACL_ROLES) {
      if (!Array.isArray(e[g]) || !e[g].every(isPriv)) {
        throw new Error(`${path}: ${safeName(name)} · ${g} must be an explicit array of privilege names ([] = none)`)
      }
    }
  }
  return j.objects
}

// acl-audit [--report <file.json>] [--expected <access.json>]
async function aclAudit(argv) {
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
  let expected
  try { expected = readExpected(opt('--expected') || ACL_FILE) } catch (e) { console.log(`acl audit: UNVERIFIED — ${e.message}`); process.exit(2) }
  let fetched
  if (opt('--report')) {
    try { fetched = { rows: readJson(opt('--report')) } } catch { fetched = { error: 'report file is not valid JSON' } }
  } else fetched = await fetchAclReport()
  if (fetched.error) { console.log(`acl audit: UNVERIFIED — ${fetched.error}`); process.exit(2) }
  const { objects, defaults, malformed } = parseAclReport(fetched.rows)
  if (malformed.length) { console.log('acl audit: UNVERIFIED — malformed report:'); for (const m of malformed.slice(0, 20)) console.log(`  ${m}`); process.exit(2) }
  const diffs = compareAcl(objects, expected)
  for (const d of defaults) {
    const scope = /^defaults (global|public) by [A-Za-z0-9_]{1,63}$/.test(d.object) ? d.object : 'defaults <unprintable>'
    const who = ACL_ROLES.includes(d.grantee) || /^[A-Za-z0-9_]{1,63}$/.test(d.grantee) ? d.grantee : '<unprintable>'
    console.log(`  info · ${scope} · ${d.kind} · ${who}: ${d.privileges.join(',') || '(none)'}`)
  }
  if (diffs.length) { console.log(`acl audit: FAIL — ${diffs.length} difference(s) from ${ACL_FILE}:`); for (const d of diffs) console.log(`  ${d}`); process.exit(1) }
  console.log(`acl audit: PASS — ${Object.keys(objects).length} relations match ${ACL_FILE}`)
}

// acl-snapshot: write supabase/access.json from the live report (read-only query). Baseline only.
async function aclSnapshot() {
  const fetched = await fetchAclReport()
  if (fetched.error) { console.log(`acl snapshot: failed — ${fetched.error}`); process.exit(2) }
  const { objects, malformed } = parseAclReport(fetched.rows)
  if (malformed.length) { console.log('acl snapshot: malformed report:'); for (const m of malformed) console.log(`  ${m}`); process.exit(2) }
  const sorted = {}
  for (const name of Object.keys(objects).sort()) {
    const o = objects[name]; sorted[name] = { kind: o.kind }
    for (const g of ACL_ROLES) sorted[name][g] = o[g]
  }
  writeJson(ACL_FILE, {
    note: 'Expected privileges per public relation and role — EXACT (not minimums). Checked against the live catalog by `node docs/harness/harness.mjs acl-audit` (init.sh check, PR smoke, daily). A migration that creates or changes a public table / view / sequence updates this file in the same PR. Direct relation ACLs only: not role membership, column grants, RLS, schema USAGE or grant options.',
    objects: sorted,
  })
  console.log(`acl snapshot: wrote ${ACL_FILE} — ${Object.keys(sorted).length} relations`)
}

// acl-selftest: every case under docs/harness/test/acl/<case>/ has report.json, access.json and
// expect (the exit code). Offline — no network.
function aclSelftest() {
  const dir = join(dirname(new URL(import.meta.url).pathname), 'test', 'acl')
  let failures = 0
  for (const name of readdirSync(dir).sort()) {
    const c = join(dir, name)
    const want = Number(readFileSync(join(c, 'expect'), 'utf8').trim())
    const r = spawnSync(process.execPath, [new URL(import.meta.url).pathname, 'acl-audit', '--report', join(c, 'report.json'), '--expected', join(c, 'access.json')], { encoding: 'utf8', env: {} })
    const out = `${r.stdout || ''}${r.stderr || ''}`
    const forbid = existsSync(join(c, 'forbid')) ? readFileSync(join(c, 'forbid'), 'utf8').split('\n').filter(Boolean) : []
    const leaked = forbid.filter(f => out.includes(f))
    const ok = r.status === want && !leaked.length
    if (!ok) failures++
    // A leaking case never prints the captured output (it would repeat the leak)
    const detail = ok ? '' : leaked.length ? ' — output contains a forbidden string (sentinel leak); output withheld' : '\n' + out
    console.log(`  ${ok ? '✓' : '✗'} ${name}: exit ${r.status} (want ${want})${detail}`)
  }
  console.log(failures ? `acl selftest: FAIL — ${failures} case(s)` : 'acl selftest: PASS')
  process.exit(failures ? 1 : 0)
}

const commands = {
  stamp: () => stamp(args[0]),
  'lint-baseline': () => lintBaseline(args[0], args[1], args[2]),
  'lint-compare': () => lintCompare(args[0], args[1], args[2], args[3]),
  signatures: () => signatures(args[0], args[1], args[2]),
  classify: () => classify(args[0], args[1], args[2], args[3]),
  'vercel-ok': () => vercelOk(args[0]),
  'acl-audit': () => aclAudit(args),
  'acl-snapshot': () => aclSnapshot(),
  'acl-selftest': () => aclSelftest(),
}
if (!commands[cmd]) { console.error(`unknown command: ${cmd}`); process.exit(2) }
commands[cmd]()
