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
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

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

const commands = {
  stamp: () => stamp(args[0]),
  'lint-baseline': () => lintBaseline(args[0], args[1], args[2]),
  'lint-compare': () => lintCompare(args[0], args[1], args[2], args[3]),
  signatures: () => signatures(args[0], args[1], args[2]),
  classify: () => classify(args[0], args[1], args[2], args[3]),
  'vercel-ok': () => vercelOk(args[0]),
}
if (!commands[cmd]) { console.error(`unknown command: ${cmd}`); process.exit(2) }
commands[cmd]()
