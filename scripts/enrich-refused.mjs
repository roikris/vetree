// Codex fallback for articles Claude refused (CLAUDE.md rule 0 exception, Roi 2026-10-06).
//
// Runs on Roi's Mac with Codex signed in to his ChatGPT plan — never in CI, never with an API key.
// Takes the articles the daily job hid as ai_refused, sends each one the IDENTICAL prompt Claude got
// (.github/workflows/scripts/enrichment-prompt.js), validates the reply with the same rules, and saves
// valid summaries (prompt_version '…+fallback:codex:<model>'), which makes them visible.
//
//   npm run enrich:refused                 # all waiting articles
//   npm run enrich:refused -- --dry-run    # ask Codex, show the results, write nothing
//   npm run enrich:refused -- --limit 5 --batch 5
//   npm run enrich:refused -- --dry-run --ids <id>,<id>   # preview chosen articles (dry run only)
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
const { PROMPT_VERSION, AI_REFUSED, SYSTEM, buildPrompt, validateEnrichment } =
  require('../.github/workflows/scripts/enrichment-prompt.js')

const MODEL = 'gpt-6-astra'  // the model whose summaries Roi reviewed (2026-10-06)
const args = process.argv.slice(2)
const flag = name => args.includes(name)
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : def }
const DRY = flag('--dry-run')
const LIMIT = opt('--limit', 100)
const BATCH = Math.max(1, Math.min(opt('--batch', 8), 20))
const IDS = args.includes('--ids') ? String(args[args.indexOf('--ids') + 1] || '').split(',').filter(Boolean) : null
if (IDS && !DRY) die('--ids is only allowed together with --dry-run')

function die(msg) { console.error(`✗ ${msg}`); process.exit(1) }

// Guards: Roi's machine, Codex on his ChatGPT plan — never an API key (separate billing).
if (process.env.CI) die('not in CI — this runs only on Roi\'s Mac with Codex signed in to ChatGPT')
// `codex login status` prints to stderr — read both streams
const status = spawnSync('codex', ['login', 'status'], { encoding: 'utf8' })
const login = `${status.stdout || ''}${status.stderr || ''}`
if (!/Logged in using ChatGPT/i.test(login)) die('Codex is not signed in with ChatGPT (an API-key login would bill separately). Run `codex login` and choose ChatGPT.')
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!process.env[k]) die(`${k} missing — run via \`npm run enrich:refused\` (loads .env.local)`)

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Waiting = marked ai_refused (not `summary IS NULL`: pre-057 rows hold a copy of the abstract there)
let query = supabase.from('articles')
  .select('id, title, authors, source_journal, abstract')
  .not('abstract', 'is', null)
  .order('last_enrichment_at', { ascending: true })
  .limit(LIMIT)
query = IDS ? query.in('id', IDS) : query.eq('quarantine_reason', AI_REFUSED)
const { data: articles, error } = await query
if (error) die(`query failed: ${error.message}`)
console.log(`${articles.length} article(s) waiting for the Codex fallback${DRY ? ' — DRY RUN, nothing is written' : ''}`)
if (!articles.length) process.exit(0)

function taskFor(batch) {
  let t = `You are running Vetree's enrichment fallback. You are given ONE system prompt and ${batch.length} separate user prompts. Treat EACH user prompt as an independent request: answer it exactly as you would if it were the only message in a fresh conversation with that system prompt — do not let articles influence each other, and do not use tools.

If you would decline a request, do not invent content: put {"declined": true, "reason": "<one sentence>"} as that article's result.

Your final answer must be ONLY a JSON array (no markdown fences, no commentary) with one element per article, in the given order:
[{"id": "<article id>", "result": <the JSON object you return for that prompt, or the declined object>}]

===== SYSTEM PROMPT (applies to every request) =====
${SYSTEM}
`
  for (const a of batch) t += `\n===== REQUEST id=${a.id} =====\n${buildPrompt(a)}\n`
  return t
}

async function note(id, message) {
  if (DRY) return
  await supabase.from('articles').update({ last_enrichment_error: message.slice(0, 1000), last_enrichment_at: new Date().toISOString() })
    .eq('id', id).eq('quarantine_reason', AI_REFUSED)
}

const totals = { saved: 0, declined: 0, invalid: 0, missing: 0, tokens: 0, failedBatches: 0 }
for (let i = 0; i < articles.length; i += BATCH) {
  const batch = articles.slice(i, i + BATCH)
  const dir = mkdtempSync(join(tmpdir(), 'vetree-codex-'))
  const out = join(dir, 'out.json')
  console.log(`\nBatch ${i / BATCH + 1}: ${batch.length} article(s) → Codex (${MODEL}, read-only)…`)
  // Started outside the repo so Codex never takes this for a Vetree working session (AGENTS.md).
  const run = spawnSync('codex', ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '-m', MODEL,
    '-c', 'model_reasoning_effort="medium"', '-o', out, taskFor(batch)],
  { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60 * 1000 })
  const used = Number(((run.stdout || '') + (run.stderr || '')).match(/tokens used\s*\n\s*([\d,]+)/i)?.[1]?.replace(/,/g, '') || 0)
  totals.tokens += used
  let results = []
  if (run.error || run.status !== 0) {
    // Codex itself failed (not installed, timed out, crashed, usage limit…): nothing from this batch counts
    totals.failedBatches++
    console.error(`  ✗ Codex run failed (${run.error ? run.error.message : `exit ${run.status}${run.signal ? `, ${run.signal}` : ''}`}). Nothing saved for this batch.`)
  } else {
    try {
      results = JSON.parse(readFileSync(out, 'utf8').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
    } catch (e) {
      totals.failedBatches++
      console.error(`  ✗ Codex reply was not a JSON array (${e.message}). Nothing saved for this batch.`)
    }
  }
  rmSync(dir, { recursive: true, force: true })
  if (!Array.isArray(results) || !results.length) continue  // failed batch: no per-article notes, retry next run
  const byId = Object.fromEntries((Array.isArray(results) ? results : []).map(r => [r && r.id, r && r.result]))

  for (const a of batch) {
    const r = byId[a.id]
    const label = `${a.id} · ${String(a.title).slice(0, 60)}`
    if (!r) { totals.missing++; console.log(`  ? no result: ${label}`); await note(a.id, 'Codex fallback: no result returned'); continue }
    if (r.declined) { totals.declined++; console.log(`  ⊘ declined: ${label} — ${r.reason}`); await note(a.id, `Codex fallback declined: ${r.reason || ''}`); continue }
    const { validLabels, isComplete, missing } = validateEnrichment(r)
    if (!isComplete) { totals.invalid++; console.log(`  ✗ incomplete (${missing.join(', ')}): ${label}`); await note(a.id, `Codex fallback incomplete - missing: ${missing.join(', ')}`); continue }
    if (DRY) { totals.saved++; console.log(`  ✓ would save: ${label}\n      ${r.clinical_bottom_line}`); continue }
    const updates = {
      summary: r.summary,
      clinical_bottom_line: r.clinical_bottom_line,
      labels: validLabels,
      strength_of_evidence: r.strength_of_evidence || null,
      ...(r.authors ? { authors: r.authors } : {}),
      needs_enrichment: false,
      force_retry: false,
      quarantined: false,
      quarantine_reason: null,
      last_enrichment_at: new Date().toISOString(),
      last_enrichment_error: null,
      prompt_version: `${PROMPT_VERSION}+fallback:codex:${MODEL}`,
    }
    // Guarded: only an article that is still ai_refused (nothing else changed it meanwhile)
    const { data: saved, error: saveError } = await supabase.from('articles').update(updates)
      .eq('id', a.id).eq('quarantine_reason', AI_REFUSED).select('id')
    if (saveError || !saved || saved.length !== 1) {
      totals.invalid++; console.log(`  ✗ not saved: ${label} — ${saveError ? saveError.message : 'no longer waiting (changed meanwhile)'}`)
    } else { totals.saved++; console.log(`  ✓ saved: ${label}`) }
  }
}
console.log(`\n${DRY ? 'Would save' : 'Saved'}: ${totals.saved} · declined: ${totals.declined} · incomplete/not saved: ${totals.invalid} · no result: ${totals.missing} · failed Codex batches: ${totals.failedBatches} · Codex tokens: ${totals.tokens.toLocaleString()}`)
if (totals.failedBatches) process.exit(1)
