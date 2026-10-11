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
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
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
  const audits = [failed.includes('acl') && 'the access-control audit', failed.includes('rls') && 'the policy audit'].filter(Boolean)
  if (audits.length) {
    console.log(`REGRESSION: ${audits.join(' and ')} failed — never an expected WIP failure`)
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

async function fetchAclReport(rpc = 'harness_acl_report') {
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
      if (ap.roles.join('\n') !== ep.roles.join('\n')) diffs.push(`POLICY ${at} · roles — expected ${ep.roles.map(escCtl).join(',')}, production ${ap.roles.map(escCtl).join(',')}`)
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
  try { expected = readRlsExpected(file) } catch (e) { console.log(`rls audit: UNVERIFIED — ${e.message}`); process.exit(2) }
  const actual = await rlsActual(argv, 'rls audit')
  const diffs = compareRls(actual, expected)
  if (diffs.length) { console.log(`rls audit: FAIL — ${diffs.length} difference(s) from ${file}:`); for (const d of diffs) console.log(`  ${d}`); process.exit(1) }
  const n = [...actual.values()].reduce((s, t) => s + t.policies.size, 0)
  console.log(`rls audit: PASS — ${actual.size} tables, ${n} policies match ${file}`)
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
  writeJson(tmp, { note: RLS_NOTE, tables })
  try { if (compareRls(actual, readRlsExpected(tmp)).length) throw new Error('round trip differs') } catch (e) {
    rmSync(tmp, { force: true }); console.log(`rls snapshot: failed — ${escCtl(e.message)}`); process.exit(2)
  }
  renameSync(tmp, out)
  const n = [...actual.values()].reduce((s, t) => s + t.policies.size, 0)
  console.log(`rls snapshot: wrote ${out} — ${actual.size} tables, ${n} policies`)
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
  // `env.json` (the child's whole environment; default empty), `before.json` (copied to {out} first) and
  // `after.json` ({out} must equal it afterwards) or `after-absent` ({out} must not exist afterwards).
  const adir = join(dirname(new URL(import.meta.url).pathname), 'test', 'rls-audit')
  for (const name of readdirSync(adir).sort()) {
    const c = join(adir, name)
    const want = Number(readFileSync(join(c, 'expect'), 'utf8').trim())
    const tmp = mkdtempSync(join(tmpdir(), 'rls-selftest-')), out = join(tmp, 'rls.json')
    if (existsSync(join(c, 'before.json'))) copyFileSync(join(c, 'before.json'), out)
    const fill = s => s.replace('{report}', join(c, 'report.json')).replace('{expected}', join(c, 'rls.json')).replace('{out}', out)
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
}
if (!commands[cmd]) { console.error(`unknown command: ${cmd}`); process.exit(2) }
commands[cmd]()
