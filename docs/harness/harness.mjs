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
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
  const audits = [failed.includes('acl') && 'the access-control audit', failed.includes('rls') && 'the policy audit',
    failed.includes('schema') && 'the schema audit'].filter(Boolean)
  if (audits.length) {
    console.log(`REGRESSION: ${audits.join(' and ')} failed — never an expected WIP failure`)
    process.exit(1)
  }
  if (failed.includes('unit')) {
    console.log('REGRESSION: the unit tests failed — never an expected WIP failure (they run offline in every mode)')
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

// shape: 'array' (074 / 075 return rows) or 'object' (080 returns one jsonb value)
async function fetchAclReport(rpc = 'harness_acl_report', shape = 'array') {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { error: 'missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }
  let res
  try {
    res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${rpc}`, {
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
  if (shape === 'object') {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return { error: 'report is not an object' }
  } else if (!Array.isArray(body)) return { error: 'report is not an array' }
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

// rls-report: print production's row-level security per public table (public.harness_rls_report(), migration 075 —
// catalog only, never a row of data). Read-only and informational (infra-002): exit 0 printed, 2 not fetched /
// malformed. The whole report is validated before anything is printed, so a malformed one never reads as a result.
// Control characters in names / expressions are printed escaped (\xNN), never passed to the terminal.
const RLS_COMMANDS = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'])
const escCtl = v => String(v).replace(/[\u0000-\u001f\u007f-\u009f]/g, c => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
function parseRlsReport(rows) {
  const tables = {}, policies = [], malformed = []
  if (!Array.isArray(rows)) return { tables, malformed: ['report is not an array'] }
  const isStrOrNull = v => v === null || typeof v === 'string'
  rows.forEach((r, i) => {
    const at = `row ${i + 1}`
    if (!r || typeof r.object !== 'string' || !/^public\.[A-Za-z0-9_]{1,63}$/.test(r.object)) { malformed.push(`${at}: object is not a public table name`); return }
    if (r.kind === 'table') {
      if (typeof r.rls_on !== 'boolean' || typeof r.rls_forced !== 'boolean') { malformed.push(`${r.object}: rls_on / rls_forced are not booleans`); return }
      if (r.policy !== null || r.command !== null || r.roles !== null || r.permissive !== null || r.using_expr !== null || r.check_expr !== null) { malformed.push(`${r.object}: table row carries policy fields`); return }
      if (tables[r.object]) { malformed.push(`${r.object}: two table rows`); return }
      tables[r.object] = { rls: r.rls_on, forced: r.rls_forced, policies: [] }
    } else if (r.kind === 'policy') {
      if (r.rls_on !== null || r.rls_forced !== null) { malformed.push(`${r.object}: policy row carries table fields`); return }
      if (typeof r.policy !== 'string' || !r.policy.length) { malformed.push(`${r.object}: policy without a name`); return }
      if (!RLS_COMMANDS.has(r.command)) { malformed.push(`${r.object}: policy with an unknown command`); return }
      if (!Array.isArray(r.roles) || !r.roles.length || !r.roles.every(x => typeof x === 'string' && x.length)) { malformed.push(`${r.object}: policy roles are not a non-empty list of names`); return }
      if (typeof r.permissive !== 'boolean' || !isStrOrNull(r.using_expr) || !isStrOrNull(r.check_expr)) { malformed.push(`${r.object}: policy fields have the wrong types`); return }
      policies.push(r)
    } else malformed.push(`${at}: unknown kind`)
  })
  for (const p of policies) {
    const t = tables[p.object]
    if (!t) { malformed.push(`${p.object}: policy for a table with no table row`); continue }
    if (t.policies.some(q => q.policy === p.policy)) { malformed.push(`${p.object}: two policies with the same name`); continue }
    t.policies.push(p)
  }
  return { tables, malformed }
}
// rls-report [--report <file.json>] — the file option is for offline tests (rls-selftest)
async function rlsReport(argv = []) {
  const i = argv.indexOf('--report')
  let fetched
  if (i >= 0) { try { fetched = { rows: readJson(argv[i + 1]) } } catch { fetched = { error: 'report file is not valid JSON' } } }
  else fetched = await fetchAclReport('harness_rls_report')
  if (fetched.error) { console.log(`rls report: UNVERIFIED — ${fetched.error}`); process.exit(2) }
  const { tables, malformed } = parseRlsReport(fetched.rows)
  if (malformed.length) { console.log('rls report: UNVERIFIED — malformed report:'); for (const m of malformed.slice(0, 20)) console.log(`  ${escCtl(m)}`); process.exit(2) }
  const names = Object.keys(tables).sort()
  if (!names.length) { console.log('rls report: UNVERIFIED — no tables in the report'); process.exit(2) }
  for (const n of names) {
    const t = tables[n]
    console.log(`${n}  RLS ${t.rls ? 'on' : 'OFF'}${t.forced ? ' (forced)' : ''} · ${t.policies.length} polic${t.policies.length === 1 ? 'y' : 'ies'}`)
    for (const p of t.policies.sort((a, b) => a.policy.localeCompare(b.policy))) {
      console.log(`    ${p.command} to ${p.roles.map(escCtl).join(',')}${p.permissive ? '' : ' (restrictive)'} · "${escCtl(p.policy)}"`)
      console.log(`        using: ${p.using_expr === null ? '-' : escCtl(p.using_expr)}`)
      console.log(`        check: ${p.check_expr === null ? '-' : escCtl(p.check_expr)}`)
    }
  }
  const off = names.filter(n => !tables[n].rls)
  console.log(`rls report: ${names.length} tables · RLS off on ${off.length}${off.length ? ': ' + off.join(', ') : ''}`)
}

// ---------------------------------------------------------------- policy audit (infra-002)
// Compares production's row-level security (public.harness_rls_report(), migration 075) with the checked-in
// expectation supabase/rls.json, exactly: per public table RLS on / forced, and every policy's command, roles,
// permissive flag and USING / WITH CHECK text as pg_get_expr prints it (byte for byte — no normalisation, so a
// Postgres upgrade that re-prints an expression shows up as a diff to review). Exit 0 = match, 1 = mismatch,
// 2 = unverified (not fetched, empty or malformed report, or an invalid rls.json) — never a pass.
// Both sides are validated into one canonical form (Maps, roles sorted) before comparing or snapshotting.
const RLS_FILE = 'supabase/rls.json'
const RLS_NOTE = 'Expected row-level security per public table — EXACT. Checked against the live catalog by `node docs/harness/harness.mjs rls-audit` (init.sh check, PR smoke, daily). A migration that creates, changes or drops a policy, toggles RLS, or adds / drops a table updates this file in the same PR. Expressions are pg_get_expr text, compared byte for byte.'
const TABLE_NAME = /^public\.[A-Za-z0-9_]{1,63}$/
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const exactKeys = (o, keys) => Object.keys(o).length === keys.length && keys.every(k => hasOwn(o, k))
const sortRoles = roles => [...roles].sort()

// parseRlsReport's tables → canonical Map
function rlsCanonFromReport(tables) {
  const out = new Map()
  for (const name of Object.keys(tables)) {
    const t = tables[name], policies = new Map()
    for (const p of t.policies) {
      policies.set(p.policy, { command: p.command, roles: sortRoles(p.roles), permissive: p.permissive, using: p.using_expr, check: p.check_expr })
    }
    out.set(name, { rls: t.rls, forced: t.forced, policies })
  }
  return out
}

// rls.json → canonical Map; throws on anything outside the contract (unknown or missing keys included)
function readRlsExpected(path) {
  let j
  try { j = readJson(path) } catch { throw new Error(`${path}: not readable JSON`) }
  if (!isObj(j) || !exactKeys(j, ['note', 'tables']) || typeof j.note !== 'string' || !isObj(j.tables)) {
    throw new Error(`${path}: must be an object with exactly "note" (string) and "tables" (object)`)
  }
  const out = new Map()
  for (const name of Object.keys(j.tables)) {
    if (!TABLE_NAME.test(name)) throw new Error(`${path}: a table key is not a public table name`)
    const t = j.tables[name]
    if (!isObj(t) || !exactKeys(t, ['rls', 'forced', 'policies']) || typeof t.rls !== 'boolean' || typeof t.forced !== 'boolean' || !isObj(t.policies)) {
      throw new Error(`${path}: ${name} must have exactly "rls" (bool), "forced" (bool), "policies" (object)`)
    }
    const policies = new Map()
    for (const pname of Object.keys(t.policies)) {
      const p = t.policies[pname], at = `${name} "${escCtl(pname)}"`
      if (!pname.length) throw new Error(`${path}: ${name} has a policy with an empty name`)
      if (!isObj(p) || !exactKeys(p, ['command', 'roles', 'permissive', 'using', 'check'])) {
        throw new Error(`${path}: ${at} must have exactly "command", "roles", "permissive", "using", "check"`)
      }
      if (!RLS_COMMANDS.has(p.command)) throw new Error(`${path}: ${at} has an unknown command`)
      if (!Array.isArray(p.roles) || !p.roles.length || !p.roles.every(r => typeof r === 'string' && r.length) || new Set(p.roles).size !== p.roles.length) {
        throw new Error(`${path}: ${at} roles must be a non-empty list of distinct names`)
      }
      if (typeof p.permissive !== 'boolean') throw new Error(`${path}: ${at} permissive must be a boolean`)
      for (const k of ['using', 'check']) if (p[k] !== null && typeof p[k] !== 'string') throw new Error(`${path}: ${at} ${k} must be a string or null`)
      policies.set(pname, { command: p.command, roles: sortRoles(p.roles), permissive: p.permissive, using: p.using, check: p.check })
    }
    out.set(name, { rls: t.rls, forced: t.forced, policies })
  }
  return out
}

const rlsShow = v => (v === null ? '(none)' : `"${escCtl(v)}"`)
function compareRls(actual, expected) {
  const diffs = []
  for (const name of [...new Set([...actual.keys(), ...expected.keys()])].sort()) {
    const a = actual.get(name), e = expected.get(name)
    if (!e) { diffs.push(`NEW    ${name} — in production, not in ${RLS_FILE}`); continue }
    if (!a) { diffs.push(`GONE   ${name} — in ${RLS_FILE}, not in production`); continue }
    if (a.rls !== e.rls) diffs.push(`RLS    ${name} — expected ${e.rls ? 'on' : 'off'}, production ${a.rls ? 'on' : 'off'}`)
    if (a.forced !== e.forced) diffs.push(`FORCED ${name} — expected ${e.forced}, production ${a.forced}`)
    for (const pname of [...new Set([...a.policies.keys(), ...e.policies.keys()])].sort()) {
      const ap = a.policies.get(pname), ep = e.policies.get(pname), at = `${name} "${escCtl(pname)}"`
      if (!ep) { diffs.push(`NEW    policy ${at} — ${ap.command} to ${ap.roles.map(escCtl).join(',')} · using ${rlsShow(ap.using)} · check ${rlsShow(ap.check)}`); continue }
      if (!ap) { diffs.push(`GONE   policy ${at}`); continue }
      if (ap.command !== ep.command) diffs.push(`POLICY ${at} · command — expected ${ep.command}, production ${ap.command}`)
      if (ap.roles.length !== ep.roles.length || ap.roles.some((r, i) => r !== ep.roles[i])) diffs.push(`POLICY ${at} · roles — expected ${ep.roles.map(escCtl).join(',')}, production ${ap.roles.map(escCtl).join(',')}`)
      if (ap.permissive !== ep.permissive) diffs.push(`POLICY ${at} · permissive — expected ${ep.permissive}, production ${ap.permissive}`)
      for (const k of ['using', 'check']) if (ap[k] !== ep[k]) diffs.push(`POLICY ${at} · ${k} — expected ${rlsShow(ep[k])}, production ${rlsShow(ap[k])}`)
    }
  }
  return diffs
}

// Fetch (or read --report) and validate; returns the canonical Map or prints UNVERIFIED and exits 2
async function rlsActual(argv, label) {
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
  let fetched
  if (opt('--report')) { try { fetched = { rows: readJson(opt('--report')) } } catch { fetched = { error: 'report file is not valid JSON' } } }
  else fetched = await fetchAclReport('harness_rls_report')
  if (fetched.error) { console.log(`${label}: UNVERIFIED — ${fetched.error}`); process.exit(2) }
  const { tables, malformed } = parseRlsReport(fetched.rows)
  if (malformed.length) { console.log(`${label}: UNVERIFIED — malformed report:`); for (const m of malformed.slice(0, 20)) console.log(`  ${escCtl(m)}`); process.exit(2) }
  if (!Object.keys(tables).length) { console.log(`${label}: UNVERIFIED — no tables in the report`); process.exit(2) }
  return rlsCanonFromReport(tables)
}

// rls-audit [--report <file.json>] [--expected <rls.json>]
async function rlsAudit(argv) {
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
  const file = opt('--expected') || RLS_FILE
  let expected
  try { expected = readRlsExpected(file) } catch (e) { console.log(`rls audit: UNVERIFIED — ${escCtl(e.message)}`); process.exit(2) }
  const actual = await rlsActual(argv, 'rls audit')
  const diffs = compareRls(actual, expected)
  if (diffs.length) { console.log(`rls audit: FAIL — ${diffs.length} difference(s) from ${escCtl(file)}:`); for (const d of diffs) console.log(`  ${d}`); process.exit(1) }
  const n = [...actual.values()].reduce((s, t) => s + t.policies.size, 0)
  console.log(`rls audit: PASS — ${actual.size} tables, ${n} policies match ${escCtl(file)}`)
}

// rls-snapshot [--report <file.json>] [--out <rls.json>]: write the expectation from a validated, non-empty
// report (read-only query). Baseline only — never to paper over a difference. On any error the existing file
// is left untouched (written to a temp file, checked, then renamed over it).
async function rlsSnapshot(argv) {
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
  const out = opt('--out') || RLS_FILE
  const actual = await rlsActual(argv, 'rls snapshot')
  const tables = {}
  for (const name of [...actual.keys()].sort()) {
    const t = actual.get(name), policies = {}
    for (const pname of [...t.policies.keys()].sort()) {
      const p = t.policies.get(pname)
      Object.defineProperty(policies, pname, { value: { command: p.command, roles: p.roles, permissive: p.permissive, using: p.using, check: p.check }, enumerable: true, writable: true, configurable: true })
    }
    tables[name] = { rls: t.rls, forced: t.forced, policies }
  }
  const tmp = `${out}.tmp-${process.pid}`
  try {
    writeJson(tmp, { note: RLS_NOTE, tables })
    if (compareRls(actual, readRlsExpected(tmp)).length) throw new Error('round trip differs')
    renameSync(tmp, out)
  } catch (e) {
    try { rmSync(tmp, { force: true }) } catch { /* the temp file may not exist */ }
    console.log(`rls snapshot: failed — ${e?.code && /^[A-Z]{2,20}$/.test(e.code) ? e.code : escCtl(e?.message || 'error')}`); process.exit(2)
  }
  const n = [...actual.values()].reduce((s, t) => s + t.policies.size, 0)
  console.log(`rls snapshot: wrote ${escCtl(out)} — ${actual.size} tables, ${n} policies`)
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

// rls-selftest: every case under docs/harness/test/rls/<case>/ has report.json, expect (exit code) and optionally
// contains / forbid (one string per line that the output must / must not include).
function rlsSelftest() {
  const dir = join(dirname(new URL(import.meta.url).pathname), 'test', 'rls')
  let failures = 0
  const lines = f => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean) : [])
  for (const name of readdirSync(dir).sort()) {
    const c = join(dir, name)
    const want = Number(readFileSync(join(c, 'expect'), 'utf8').trim())
    const r = spawnSync(process.execPath, [new URL(import.meta.url).pathname, 'rls-report', '--report', join(c, 'report.json')], { encoding: 'utf8', env: {} })
    const out = `${r.stdout || ''}${r.stderr || ''}`
    const missing = lines(join(c, 'contains')).filter(x => !out.includes(x))
    const leaked = lines(join(c, 'forbid')).filter(x => out.includes(x))
    const ok = r.status === want && !missing.length && !leaked.length
    if (!ok) failures++
    const detail = ok ? '' : leaked.length ? ' — output contains a forbidden string; output withheld' : `${missing.length ? ` — missing: ${missing.join(' | ')}` : ''}\n${out}`
    console.log(`  ${ok ? '✓' : '✗'} ${name}: exit ${r.status} (want ${want})${detail}`)
  }
  // Audit / snapshot cases: docs/harness/test/rls-audit/<case>/ — report.json, rls.json, expect, optional
  // contains / forbid; optional `argv` (one line, placeholders {report} {expected} {out}; default rls-audit),
  // `env.json` (the child's whole environment; default empty), `before.json` (copied to {out} first) or
  // `before-dir` ({out} is a non-empty directory, so the rename fails), and
  // `after.json` ({out} must equal it afterwards) or `after-absent` ({out} must not exist afterwards).
  const adir = join(dirname(new URL(import.meta.url).pathname), 'test', 'rls-audit')
  for (const name of readdirSync(adir).sort()) {
    const c = join(adir, name)
    const want = Number(readFileSync(join(c, 'expect'), 'utf8').trim())
    const tmp = mkdtempSync(join(tmpdir(), 'rls-selftest-')), out = join(tmp, 'rls.json')
    // {evil}: a copy of rls.json under a name with a newline and an ESC sequence (path escaping)
    const evil = join(tmp, 'x\nrls audit: PASS\u001b[2J.json')
    if (existsSync(join(c, 'before.json'))) copyFileSync(join(c, 'before.json'), out)
    if (existsSync(join(c, 'before-dir'))) { mkdirSync(join(out, 'keep'), { recursive: true }) }
    if (existsSync(join(c, 'argv')) && readFileSync(join(c, 'argv'), 'utf8').includes('{evil}')) copyFileSync(join(c, 'rls.json'), evil)
    const fill = s => s.replace('{report}', join(c, 'report.json')).replace('{expected}', join(c, 'rls.json')).replace('{out}', out).replace('{tmp}', tmp).replace('{evil}', evil)
    const argv = existsSync(join(c, 'argv')) ? readFileSync(join(c, 'argv'), 'utf8').trim().split(/\s+/).map(fill)
      : ['rls-audit', '--report', join(c, 'report.json'), '--expected', join(c, 'rls.json')]
    const env = existsSync(join(c, 'env.json')) ? readJson(join(c, 'env.json')) : {}
    const r = spawnSync(process.execPath, [new URL(import.meta.url).pathname, ...argv], { encoding: 'utf8', env })
    const output = `${r.stdout || ''}${r.stderr || ''}`
    const missing = lines(join(c, 'contains')).filter(x => !output.includes(x))
    const leaked = lines(join(c, 'forbid')).filter(x => output.includes(x))
    let fileProblem = ''
    if (existsSync(join(c, 'after.json')) && (!existsSync(out) || readFileSync(out, 'utf8') !== readFileSync(join(c, 'after.json'), 'utf8'))) fileProblem = ' — output file differs from after.json'
    if (existsSync(join(c, 'after-absent')) && existsSync(out)) fileProblem = ' — output file was written'
    if (readdirSync(tmp).some(f => f.includes('.tmp-'))) fileProblem += ' — temp file left behind'
    rmSync(tmp, { recursive: true, force: true })
    const ok = r.status === want && !missing.length && !leaked.length && !fileProblem
    if (!ok) failures++
    const detail = ok ? '' : leaked.length ? ' — output contains a forbidden string; output withheld' : `${fileProblem}${missing.length ? ` — missing: ${missing.join(' | ')}` : ''}\n${output}`
    console.log(`  ${ok ? '✓' : '✗'} audit/${name}: exit ${r.status} (want ${want})${detail}`)
  }
  console.log(failures ? `rls selftest: FAIL — ${failures} case(s)` : 'rls selftest: PASS')
  process.exit(failures ? 1 : 0)
}

// ---------------------------------------------------------------- schema audit (infra-003)
// Compares production's public schema STRUCTURE (public.harness_schema_report(), migration 080 — catalog only, never
// row data) with supabase/schema.json, exactly. schema.json is flat: one key per fact ("relation public.x · column y
// · type") → its value, keys sorted, so a PR diff shows exactly which fact changed. Exit 0 = match, 1 = mismatch,
// 2 = unverified (not fetched; malformed or incomplete report; an object kind outside the contract; another
// PostgreSQL major version; an invalid schema.json) — never a pass. Output never contains a definition, default or
// other text from the database: names, booleans and numbers are printed, text and lists only as a short sha256.
// Secret-shaped text is stored in schema.json as {"sha256": …} and listed under "redacted" (compared by hash).
const SCHEMA_FILE = 'supabase/schema.json'
const SCHEMA_NOTE = 'Expected structure of the public schema — EXACT, one key per fact. Checked against the live catalog by `node docs/harness/harness.mjs schema-audit` (init.sh check, PR smoke, daily). A migration that changes the schema updates this file in the same PR (schema-snapshot after db push — never to paper over a difference). Values under "redacted" held secret-shaped text and are stored as sha256 only. Policies: rls.json; table privileges also: access.json.'
const SEP = ' · '
// Secret-shaped text: never committed in clear (stored as sha256) and never printed
const SECRET_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,                                  // JWT
  /\bsk[-_](?:live[-_]|test[-_]|proj[-_]|ant[-_])?[A-Za-z0-9_-]{16,}/,         // secret API keys
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i,
  /\b(?:api[_-]?key|apikey|secret|password|passwd|pwd|token|service[_-]?role[_-]?key)\b["']?\s*(?:=>|:=|=|:)\s*['"]?[^\s'",;)]{8,}/i,
  /[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"]+:[^/\s@'"]+@/i,                           // URL with credentials
  /[A-Za-z0-9+/]{40,}={0,2}/,                                                  // long base64
  /\b[0-9a-f]{32,}\b/i,                                                        // long hex
]
const secretShaped = v => (typeof v === 'string' ? [v] : Array.isArray(v) ? v : []).some(s => typeof s === 'string' && SECRET_PATTERNS.some(re => re.test(s)))
const sha = v => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const isSha = v => isObj(v) && exactKeys(v, ['sha256']) && typeof v.sha256 === 'string' && /^[0-9a-f]{64}$/.test(v.sha256)

// The report's exact shape (080). 'strN' = string or null; { arr } = array of objects with exactly these keys.
const SHAPE_T = {
  str: v => typeof v === 'string', strN: v => v === null || typeof v === 'string',
  bool: v => typeof v === 'boolean', boolN: v => v === null || typeof v === 'boolean',
  int: v => Number.isInteger(v),
  strs: v => Array.isArray(v) && v.every(x => typeof x === 'string'),
  strsN: v => v === null || (Array.isArray(v) && v.every(x => typeof x === 'string')),
}
const S_ACL = { arr: { grantee: 'str', privilege: 'str', grantable: 'bool' } }
const SCHEMA_SHAPE = {
  format: 'int', server_version_num: 'int',
  relations: { arr: {
    name: 'str', kind: 'str', owner: 'str', acl: S_ACL, rls: 'bool', rls_forced: 'bool', options: 'strs',
    columns: { arr: { name: 'str', type: 'str', collation: 'strN', not_null: 'bool', default: 'strN', identity: 'strN', generated: 'strN', acl: S_ACL } },
    constraints: { arr: { name: 'str', type: 'str', definition: 'str', deferrable: 'bool', deferred: 'bool', validated: 'bool' } },
    indexes: { arr: { name: 'str', definition: 'str', valid: 'bool', ready: 'bool', constraint: 'strN' } },
    triggers: { arr: { name: 'str', definition: 'str', enabled: 'str' } },
    view_definition: 'strN',
    sequence: { objN: { type: 'str', start: 'str', increment: 'str', min: 'str', max: 'str', cache: 'str', cycle: 'bool', owned_by: 'strN' } },
  } },
  routines: { arr: { signature: 'str', kind: 'str', language: 'strN', owner: 'str', security_definer: 'bool', volatility: 'str', config: 'strs', definition: 'str', acl: S_ACL } },
  types: { arr: {
    name: 'str', kind: 'str', owner: 'str', acl: S_ACL, labels: 'strsN', base_type: 'strN', not_null: 'boolN', default: 'strN',
    constraints: { arrN: { name: 'str', definition: 'str', validated: 'bool' } }, attributes: { arrN: { name: 'str', type: 'str' } },
  } },
  schema: { obj: { owner: 'str', acl: S_ACL } },
  extensions: { arr: { name: 'str', version: 'str', schema: 'str' } },
  default_acls: { arr: { role: 'str', schema: 'strN', object_type: 'str', acl: S_ACL } },
  roles: { arr: { name: 'str', superuser: 'bool', inherit: 'bool', create_role: 'bool', create_db: 'bool', login: 'bool', replication: 'bool', bypass_rls: 'bool',
    member_of: { arr: { role: 'str', admin: 'bool', inherit: 'bool', set: 'bool' } } } },
  event_triggers: { arr: { name: 'str', event: 'str', enabled: 'str', function: 'str', tags: 'strs' } },
  publications: { arr: { name: 'str', owner: 'str', all_tables: 'bool', insert: 'bool', update: 'bool', delete: 'bool', truncate: 'bool', via_root: 'bool',
    schemas: 'strs', tables: { arr: { name: 'str', row_filter: 'strN', columns: 'strsN' } } } },
  unsupported: { arr: { kind: 'str', name: 'str' } },
  counts: { obj: Object.fromEntries(['relations', 'columns', 'constraints', 'indexes', 'triggers', 'routines', 'types', 'generated_types',
    'extensions', 'default_acls', 'event_triggers', 'publications', 'unsupported', 'all_class', 'all_type', 'all_proc', 'all_constraint'].map(k => [k, 'int'])) },
}
// Paths in messages are positions ("relations[3].columns[0]"), never content
function checkShape(v, spec, at, errs) {
  if (errs.length >= 20) return
  if (typeof spec === 'string') { if (!SHAPE_T[spec](v)) errs.push(`${at}: not ${spec}`); return }
  const [mode, inner] = Object.entries(spec)[0]
  if ((mode === 'objN' || mode === 'arrN') && v === null) return
  if (mode === 'obj' || mode === 'objN') {
    if (!isObj(v) || !exactKeys(v, Object.keys(inner))) { errs.push(`${at}: not an object with exactly the keys ${Object.keys(inner).join(', ')}`); return }
    for (const k of Object.keys(inner)) checkShape(v[k], inner[k], `${at}.${k}`, errs)
  } else {
    if (!Array.isArray(v)) { errs.push(`${at}: not an array`); return }
    v.forEach((x, i) => checkShape(x, { obj: inner }, `${at}[${i}]`, errs))
  }
}

// The report's own catalog counts must equal what its sections list (a cut-short report is never a pass)
function schemaComplete(rep) {
  const sum = f => rep.relations.reduce((n, r) => n + r[f].length, 0)
  const listed = { relations: rep.relations.length, columns: sum('columns'), constraints: sum('constraints'), indexes: sum('indexes'),
    triggers: sum('triggers'), routines: rep.routines.length, types: rep.types.length, extensions: rep.extensions.length,
    default_acls: rep.default_acls.length, event_triggers: rep.event_triggers.length, publications: rep.publications.length,
    unsupported: rep.unsupported.length }
  const errs = Object.entries(listed).filter(([k, n]) => rep.counts[k] !== n).map(([k, n]) => `incomplete report: ${k} lists ${n}, the catalog counts ${rep.counts[k]}`)
  // Inventory: every pg_class / pg_type / pg_proc / pg_constraint row in public is reported exactly once
  const uns = prefix => rep.unsupported.filter(u => u.kind.startsWith(prefix)).length
  const c = rep.counts
  const inventory = [
    ['pg_class', c.all_class, listed.relations + listed.indexes + rep.types.filter(x => x.kind === 'composite').length + uns('relation:')],
    ['pg_type', c.all_type, listed.types + c.generated_types + uns('type:')],
    ['pg_proc', c.all_proc, listed.routines + uns('routine:')],
    ['pg_constraint', c.all_constraint, listed.constraints + rep.types.reduce((n, x) => n + (x.constraints || []).length, 0)],
  ]
  for (const [cat, all, accounted] of inventory) if (all !== accounted) errs.push(`incomplete report: ${cat} holds ${all} objects in public, the report accounts for ${accounted}`)
  return errs
}
// Privilege names an ACL entry may carry (relations, columns, sequences, routines, types, schemas)
const SCHEMA_PRIVS = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN', 'USAGE', 'EXECUTE', 'CREATE'])

// Validated report → Map(fact key → value). Names that are empty, contain '·' or control characters make the
// report malformed (keys must stay unambiguous); a fact seen twice (a duplicate name) too.
function schemaFlat(rep, malformed) {
  const flat = new Map()
  // A name must be printable and unambiguous in a key — and never secret-shaped (keys are committed and printed)
  const bad = n => typeof n !== 'string' || !n.length || n.includes('·') || /[\u0000-\u001f\u007f-\u009f]/.test(n) || secretShaped(n)
  const put = (key, v) => { if (flat.has(key)) malformed.push(`a fact appears twice (duplicate name): ${escCtl(key)}`); else flat.set(key, v) }
  const each = (list, keyOf, label, fn) => list.forEach((x, i) => {
    const k = keyOf(x)
    if (bad(k)) { malformed.push(`${label}: a name is empty, secret-shaped, or contains '·' / control characters`); return }
    fn(`${label} ${k}`, x, i)
  })
  const fields = (p, x, names) => { for (const f of names) put(`${p}${SEP}${f}`, x[f]) }
  const acl = (p, list) => each(list, a => (SCHEMA_PRIVS.has(a.privilege) && !bad(a.grantee) ? `${a.grantee} ${a.privilege}` : ''),
    `${p}${SEP}acl`, (q, a) => put(q, a.grantable))
  each(rep.relations, r => r.name, 'relation', (p, r) => {
    fields(p, r, ['kind', 'owner', 'rls', 'rls_forced', 'options', 'view_definition'])
    acl(p, r.acl)
    each(r.columns, c => c.name, `${p}${SEP}column`, (q, c, i) => {
      put(`${q}${SEP}position`, i + 1)
      fields(q, c, ['type', 'collation', 'not_null', 'default', 'identity', 'generated'])
      acl(q, c.acl)
    })
    each(r.constraints, c => c.name, `${p}${SEP}constraint`, (q, c) => fields(q, c, ['type', 'definition', 'deferrable', 'deferred', 'validated']))
    each(r.indexes, x => x.name, `${p}${SEP}index`, (q, x) => fields(q, x, ['definition', 'valid', 'ready', 'constraint']))
    each(r.triggers, x => x.name, `${p}${SEP}trigger`, (q, x) => fields(q, x, ['definition', 'enabled']))
    put(`${p}${SEP}sequence`, r.sequence !== null)
    if (r.sequence) fields(`${p}${SEP}sequence`, r.sequence, ['type', 'start', 'increment', 'min', 'max', 'cache', 'cycle', 'owned_by'])
  })
  each(rep.routines, r => r.signature, 'routine', (p, r) => {
    fields(p, r, ['kind', 'language', 'owner', 'security_definer', 'volatility', 'config', 'definition'])
    acl(p, r.acl)
  })
  each(rep.types, t => t.name, 'type', (p, t) => {
    fields(p, t, ['kind', 'owner', 'labels', 'base_type', 'not_null', 'default'])
    acl(p, t.acl)
    each(t.constraints || [], c => c.name, `${p}${SEP}constraint`, (q, c) => fields(q, c, ['definition', 'validated']))
    each(t.attributes || [], a => a.name, `${p}${SEP}attribute`, (q, a, i) => { put(`${q}${SEP}position`, i + 1); put(`${q}${SEP}type`, a.type) })
  })
  put(`schema public${SEP}owner`, rep.schema.owner)
  acl('schema public', rep.schema.acl)
  each(rep.extensions, x => x.name, 'extension', (p, x) => fields(p, x, ['version', 'schema']))
  // [role, schema (null = global), object type] JSON-encoded, so no two entries can share a key
  each(rep.default_acls, d => ([d.role, d.schema, d.object_type].every(x => x === null || !bad(x)) ? JSON.stringify([d.role, d.schema, d.object_type]) : ''),
    'default privileges', (p, d) => {
    put(`${p}${SEP}present`, true)
    acl(p, d.acl)
  })
  each(rep.roles, r => r.name, 'role', (p, r) => {
    fields(p, r, ['superuser', 'inherit', 'create_role', 'create_db', 'login', 'replication', 'bypass_rls'])
    each(r.member_of, m => m.role, `${p}${SEP}member of`, (q, m) => fields(q, m, ['admin', 'inherit', 'set']))
  })
  each(rep.event_triggers, x => x.name, 'event trigger', (p, x) => fields(p, x, ['event', 'enabled', 'function', 'tags']))
  each(rep.publications, x => x.name, 'publication', (p, x) => {
    fields(p, x, ['owner', 'all_tables', 'insert', 'update', 'delete', 'truncate', 'via_root', 'schemas'])
    each(x.tables, tb => tb.name, `${p}${SEP}table`, (q, tb) => fields(q, tb, ['row_filter', 'columns']))
  })
  return flat
}

// Fetch (or read --report) and validate; returns { flat, major } or prints UNVERIFIED and exits 2
async function schemaActual(argv, label) {
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
  let fetched
  if (opt('--report')) { try { fetched = { rows: readJson(opt('--report')) } } catch { fetched = { error: 'report file is not valid JSON' } } }
  else fetched = await fetchAclReport('harness_schema_report', 'object')
  if (fetched.error) { console.log(`${label}: UNVERIFIED — ${fetched.error}`); process.exit(2) }
  const rep = fetched.rows
  const malformed = []
  checkShape(rep, { obj: SCHEMA_SHAPE }, 'report', malformed)
  if (!malformed.length && rep.format !== 1) malformed.push('report format is not 1')
  if (!malformed.length) malformed.push(...schemaComplete(rep))
  const flat = malformed.length ? null : schemaFlat(rep, malformed)
  if (malformed.length) { console.log(`${label}: UNVERIFIED — malformed report:`); for (const m of malformed.slice(0, 20)) console.log(`  ${escCtl(m)}`); process.exit(2) }
  if (!rep.relations.length) { console.log(`${label}: UNVERIFIED — no relations in the report`); process.exit(2) }
  if (rep.unsupported.length) {
    console.log(`${label}: UNVERIFIED — ${rep.unsupported.length} object(s) of a kind the audit does not cover (extend 080 + the audit, or remove them):`)
    const show = n => (secretShaped(n) ? '<secret-shaped name>' : escCtl(n))
    for (const u of rep.unsupported.slice(0, 20)) console.log(`  ${show(u.kind)} ${show(u.name)}`)
    process.exit(2)
  }
  return { flat, major: Math.floor(rep.server_version_num / 10000), rep }
}

// schema.json → { major, facts: Map, redacted: Set }; throws on anything outside the contract — including
// secret-shaped text stored in clear (it must be a sha256)
function readSchemaExpected(path) {
  let j
  try { j = readJson(path) } catch { throw new Error(`${path}: not readable JSON`) }
  if (!isObj(j) || !exactKeys(j, ['note', 'format', 'server_major', 'redacted', 'facts']) || typeof j.note !== 'string' ||
      j.format !== 1 || !Number.isInteger(j.server_major) || !Array.isArray(j.redacted) || !isObj(j.facts)) {
    throw new Error(`${path}: must have exactly "note", "format" (1), "server_major" (integer), "redacted" (list), "facts" (object)`)
  }
  const facts = new Map(), redacted = new Set()
  for (const k of j.redacted) {
    if (typeof k !== 'string' || secretShaped(k) || !hasOwn(j.facts, k) || !isSha(j.facts[k]) || redacted.has(k)) throw new Error(`${path}: "redacted" must list distinct fact keys whose values are {"sha256": …}`)
    redacted.add(k)
  }
  for (const k of Object.keys(j.facts)) {
    if (secretShaped(k)) throw new Error(`${path}: a fact key is secret-shaped (key not shown)`)
    const v = j.facts[k]
    const plain = v === null || typeof v === 'string' || typeof v === 'boolean' || Number.isInteger(v) || SHAPE_T.strs(v)
    if (!plain && !isSha(v)) throw new Error(`${path}: fact ${escCtl(k)} has a value of the wrong type`)
    if (isSha(v) && !redacted.has(k)) throw new Error(`${path}: fact ${escCtl(k)} is a sha256 but not listed under "redacted"`)
    if (plain && secretShaped(v)) throw new Error(`${path}: fact ${escCtl(k)} holds secret-shaped text in clear — store it as {"sha256": …}`)
    facts.set(k, v)
  }
  return { major: j.server_major, facts, redacted }
}

const schemaShow = v => (v === null || typeof v === 'boolean' || typeof v === 'number' ? String(v) : `sha256:${sha(v).slice(0, 12)}`)
function compareSchema(actual, expected) {
  const diffs = []
  for (const k of [...new Set([...actual.keys(), ...expected.keys()])].sort()) {
    const n = escCtl(k)
    if (!expected.has(k)) { diffs.push(`NEW   ${n} = ${schemaShow(actual.get(k))}`); continue }
    if (!actual.has(k)) { diffs.push(`GONE  ${n}`); continue }
    const a = actual.get(k), e = expected.get(k)
    const same = isSha(e) ? sha(a) === e.sha256 : JSON.stringify(a) === JSON.stringify(e)
    if (!same) diffs.push(`DIFF  ${n} — expected ${isSha(e) ? `sha256:${e.sha256.slice(0, 12)}` : schemaShow(e)}, production ${schemaShow(a)}`)
  }
  return diffs
}

// schema-audit [--report <file.json>] [--expected <schema.json>] [--skip-default-privileges]
// --skip-default-privileges: leave that one section out on both sides — only for the replay (docs/harness/replay.sh),
// whose two simulations differ from production there by design and check it themselves.
async function schemaAudit(argv) {
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
  const file = opt('--expected') || SCHEMA_FILE
  let expected
  try { expected = readSchemaExpected(file) } catch (e) { console.log(`schema audit: UNVERIFIED — ${escCtl(e.message)}`); process.exit(2) }
  const { flat, major } = await schemaActual(argv, 'schema audit')
  if (major !== expected.major) { console.log(`schema audit: UNVERIFIED — production runs PostgreSQL ${major}, ${escCtl(file)} was taken on ${expected.major} (deparsed text may differ: review and re-snapshot in a PR)`); process.exit(2) }
  if (argv.includes('--skip-default-privileges')) {
    const dp = k => k.startsWith('default privileges ')
    for (const m of [flat, expected.facts]) for (const k of [...m.keys()]) if (dp(k)) m.delete(k)
  }
  const diffs = compareSchema(flat, expected.facts)
  if (diffs.length) {
    console.log(`schema audit: FAIL — ${diffs.length} difference(s) from ${escCtl(file)}:`)
    for (const d of diffs.slice(0, 60)) console.log(`  ${d}`)
    if (diffs.length > 60) console.log(`  … and ${diffs.length - 60} more`)
    process.exit(1)
  }
  console.log(`schema audit: PASS — ${flat.size} facts match ${escCtl(file)}${expected.redacted.size ? ` (${expected.redacted.size} compared by sha256)` : ''}`)
}

// schema-report [--report <file.json>] [--out <file.json>]: validate and summarise (counts per section, the
// secret-shaped facts by key). --out writes the validated report itself — a local file for reading, never committed.
async function schemaReport(argv) {
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
  const { flat, major, rep } = await schemaActual(argv, 'schema report')
  const c = rep.counts
  console.log(`schema report: PostgreSQL ${major} · ${c.relations} relations · ${c.columns} columns · ${c.constraints} constraints · ${c.indexes} indexes · ${c.triggers} triggers · ${c.routines} routines · ${c.types} types (+${c.generated_types} generated) · ${c.extensions} extensions · ${c.default_acls} default-privilege entries · ${c.event_triggers} event triggers · ${c.publications} publications · ${flat.size} facts`)
  const secret = [...flat.keys()].filter(k => secretShaped(flat.get(k))).sort()
  console.log(`secret-shaped values: ${secret.length}${secret.length ? ' (stored as sha256 by schema-snapshot):' : ''}`)
  for (const k of secret) console.log(`  ${escCtl(k)}`)
  if (opt('--out')) {
    try { writeJson(opt('--out'), rep) } catch (e) { console.log(`schema report: could not write --out (${e?.code && /^[A-Z]{2,20}$/.test(e.code) ? e.code : 'error'})`); process.exit(2) }
    console.log(`wrote ${escCtl(opt('--out'))} (local only — it holds definitions in clear: never commit it)`)
  }
}

// schema-snapshot [--report <file.json>] [--out <schema.json>]: write the expectation from a validated, complete,
// fully covered report (read-only query). Baseline only — never to paper over a difference. Secret-shaped values are
// written as sha256 and listed. On any error the existing file is left untouched (temp file, checked, renamed).
async function schemaSnapshot(argv) {
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
  const out = opt('--out') || SCHEMA_FILE
  const { flat, major } = await schemaActual(argv, 'schema snapshot')
  const facts = {}, redacted = []
  for (const k of [...flat.keys()].sort()) {
    const v = flat.get(k)
    const stored = secretShaped(v) ? (redacted.push(k), { sha256: sha(v) }) : v
    Object.defineProperty(facts, k, { value: stored, enumerable: true, writable: true, configurable: true })
  }
  const tmp = `${out}.tmp-${process.pid}`
  try {
    writeJson(tmp, { note: SCHEMA_NOTE, format: 1, server_major: major, redacted, facts })
    const back = readSchemaExpected(tmp)
    if (back.major !== major || compareSchema(flat, back.facts).length) throw new Error('round trip differs')
    renameSync(tmp, out)
  } catch (e) {
    try { rmSync(tmp, { force: true }) } catch { /* the temp file may not exist */ }
    console.log(`schema snapshot: failed — ${e?.code && /^[A-Z]{2,20}$/.test(e.code) ? e.code : escCtl(e?.message || 'error')}`); process.exit(2)
  }
  console.log(`schema snapshot: wrote ${escCtl(out)} — ${flat.size} facts, ${redacted.length} stored as sha256${redacted.length ? ':' : ''}`)
  for (const k of redacted) console.log(`  ${escCtl(k)}`)
}

// replay-defaults <before.txt> <after.txt> <schema.json> (infra-003, used by docs/harness/replay.sh): the default
// privileges of the rebuilt database, listed before and after every migration (one entry per line: role · schema |
// (global) · type · grantee:PRIVILEGE:t|f,… merged across grantors), stay what the simulation set: nothing removed or
// changed; an entry ADDED by a migration (e.g. CREATE EXTENSION pg_cron's Supabase hook, schema cron) must be outside
// public, grant nothing to anon / authenticated / service_role / PUBLIC, and equal production's entry exactly
// (grantees, privileges, grant options — supabase/schema.json). Exit 0 ok, 1 not, 2 unreadable. Names only in output.
function replayDefaults(beforePath, afterPath, schemaPath) {
  let before, after, facts
  try { before = readFileSync(beforePath, 'utf8'); after = readFileSync(afterPath, 'utf8'); facts = readSchemaExpected(schemaPath).facts }
  catch (e) { console.log(`default privileges: UNVERIFIED — ${escCtl(e.message || 'unreadable input')}`); process.exit(2) }
  const lines = txt => txt.split('\n').filter(Boolean)
  const b = new Set(lines(before)), a = new Set(lines(after))
  const name = l => escCtl(l.split(' · ').slice(0, 3).join(' · '))
  const bad = [...b].filter(l => !a.has(l)).map(l => `removed or changed: ${name(l)}`)
  const added = [...a].filter(l => !b.has(l))
  for (const l of added) {
    const parts = l.split(' · ')
    if (parts.length < 3 || parts.length > 4) { bad.push('an entry is not role · schema · type · acl'); continue }
    const [role, schemaName, type, acl = ''] = parts
    const at = name(l)
    const entries = acl ? acl.split(',').map(e => e.split(':')) : []
    if (entries.some(e => e.length !== 3 || !['t', 'f'].includes(e[2]))) { bad.push(`added, unreadable ACL: ${at}`); continue }
    if (schemaName === 'public') bad.push(`added in public: ${at}`)
    if (entries.some(([g]) => ['PUBLIC', 'anon', 'authenticated', 'service_role'].includes(g))) bad.push(`added, grants to an API role or PUBLIC: ${at}`)
    const key = `default privileges ${JSON.stringify([role, schemaName === '(global)' ? null : schemaName, type])}`
    if (!facts.has(`${key}${SEP}present`)) { bad.push(`added, not in production: ${at}`); continue }
    const pre = `${key}${SEP}acl `
    const want = [...facts.keys()].filter(k => k.startsWith(pre)).map(k => `${k.slice(pre.length)}:${facts.get(k) ? 't' : 'f'}`).sort()
    const have = entries.map(([g, p, o]) => `${g} ${p}:${o}`).sort()
    if (JSON.stringify(want) !== JSON.stringify(have)) bad.push(`added, privileges differ from production: ${at}`)
  }
  for (const x of bad) console.log(`default privileges: ${x}`)
  console.log(`default privileges: ${b.size} before, ${a.size} after${bad.length ? ` — ${bad.length} problem(s)` : ` (${added.length} added by migrations, each exactly as in production and outside public)`}`)
  process.exit(bad.length ? 1 : 0)
}

// schema-selftest: every case under docs/harness/test/schema/<case>/ — report.json, schema.json, expect (exit code),
// optional contains / forbid (one string per line), argv (one line; placeholders {report} {expected} {out} {tmp};
// default schema-audit --report {report} --expected {expected}), env.json (the child's whole environment; default
// empty), before.json (copied to {out} first), after.json ({out} must equal it) or after-absent ({out} must not exist).
function schemaSelftest() {
  const dir = join(dirname(new URL(import.meta.url).pathname), 'test', 'schema')
  const lines = f => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean) : [])
  let failures = 0
  for (const name of readdirSync(dir).sort()) {
    const c = join(dir, name)
    const want = Number(readFileSync(join(c, 'expect'), 'utf8').trim())
    const tmp = mkdtempSync(join(tmpdir(), 'schema-selftest-')), out = join(tmp, 'schema.json')
    if (existsSync(join(c, 'before.json'))) copyFileSync(join(c, 'before.json'), out)
    const fill = s => s.replace('{report}', join(c, 'report.json')).replace('{expected}', join(c, 'schema.json')).replace('{out}', out).replace('{tmp}', tmp)
    const argv = existsSync(join(c, 'argv')) ? readFileSync(join(c, 'argv'), 'utf8').trim().split(/\s+/).map(fill)
      : ['schema-audit', '--report', join(c, 'report.json'), '--expected', join(c, 'schema.json')]
    const env = existsSync(join(c, 'env.json')) ? readJson(join(c, 'env.json')) : {}
    const r = spawnSync(process.execPath, [new URL(import.meta.url).pathname, ...argv], { encoding: 'utf8', env })
    const output = `${r.stdout || ''}${r.stderr || ''}`
    const missing = lines(join(c, 'contains')).filter(x => !output.includes(x))
    const leaked = lines(join(c, 'forbid')).filter(x => output.includes(x))
    let fileProblem = ''
    if (existsSync(join(c, 'after.json')) && (!existsSync(out) || readFileSync(out, 'utf8') !== readFileSync(join(c, 'after.json'), 'utf8'))) fileProblem = ' — output file differs from after.json'
    if (existsSync(join(c, 'after-absent')) && existsSync(out)) fileProblem = ' — output file was written'
    if (readdirSync(tmp).some(f => f.includes('.tmp-'))) fileProblem += ' — temp file left behind'
    rmSync(tmp, { recursive: true, force: true })
    const ok = r.status === want && !missing.length && !leaked.length && !fileProblem
    if (!ok) failures++
    const detail = ok ? '' : leaked.length ? ' — output contains a forbidden string; output withheld' : `${fileProblem}${missing.length ? ` — missing: ${missing.join(' | ')}` : ''}\n${output}`
    console.log(`  ${ok ? '✓' : '✗'} ${name}: exit ${r.status} (want ${want})${detail}`)
  }
  console.log(failures ? `schema selftest: FAIL — ${failures} case(s)` : 'schema selftest: PASS')
  process.exit(failures ? 1 : 0)
}

// log-grew <base> <new> <session-id> (harness-004): exit 0 only when <new> is <base> byte for byte followed by
// appended text that contains this session's entry header. Used by `init.sh unlock` on the exact blobs it compares
// and publishes. Byte exact (Buffers: no decoding, no newline normalisation). Prints sizes / offsets only, never
// content. Exit 1 = refuse, 2 = could not check.
function logGrew(basePath, newPath, id) {
  let base, next
  try { base = readFileSync(basePath); next = readFileSync(newPath) } catch { console.log('log check: could not read the two versions'); process.exit(2) }
  if (typeof id !== 'string' || !id.length || /[\u0000-\u001f]/.test(id)) { console.log('log check: no valid session id'); process.exit(2) }
  if (next.length <= base.length) { console.log(`session-log.md would shrink or not grow: ${base.length} → ${next.length} bytes`); process.exit(1) }
  if (!next.subarray(0, base.length).equals(base)) {
    let k = 0
    while (k < base.length && next[k] === base[k]) k++
    let line = 1
    for (let i = 0; i < k; i++) if (base[i] === 0x0a) line++
    console.log(`an earlier part of session-log.md changed — first difference at byte ${k} (line ${line})`)
    process.exit(1)
  }
  if (!next.subarray(base.length).includes(Buffer.from(`### Session ${id} · `, 'utf8'))) {
    console.log("this session's entry ('### Session <id> · …') is not in the appended text")
    process.exit(1)
  }
  console.log(`log check: ok — ${base.length} → ${next.length} bytes, appended only`)
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
  'rls-report': () => rlsReport(args),
  'rls-selftest': () => rlsSelftest(),
  'rls-audit': () => rlsAudit(args),
  'rls-snapshot': () => rlsSnapshot(args),
  'schema-report': () => schemaReport(args),
  'schema-audit': () => schemaAudit(args),
  'schema-snapshot': () => schemaSnapshot(args),
  'schema-selftest': () => schemaSelftest(),
  'replay-defaults': () => replayDefaults(args[0], args[1], args[2]),
  'log-grew': () => logGrew(args[0], args[1], args[2]),
}
if (!commands[cmd]) { console.error(`unknown command: ${cmd}`); process.exit(2) }
commands[cmd]()
