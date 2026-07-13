#!/usr/bin/env node
/**
 * qa-triage.mjs
 * Reads playwright-report/results.json, triages failures with Claude Sonnet,
 * and posts a compact result to Slack.
 */

import fs from 'fs'
import https from 'https'

const REPORT_PATH = 'playwright-report/results.json'
const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const RUN_URL = process.env.GITHUB_RUN_URL || ''
const TRIGGER = process.env.TRIGGER || 'unknown'

// Map test title fragments → feature description for triage context
const TEST_FEATURE_MAP = {
  'homepage': 'Homepage article feed render',
  'article page': 'Article detail page (title + clinical bottom line)',
  'search': 'Search bar — query submission and results',
  'save-intent': 'Save-to-library funnel (intent=save deep link, auth sheet)',
  'auth round-trip': 'Auth login + save + library + unsave flow',
  'sitemap': 'Sitemap.xml and robots.txt',
}

function featureFor(title) {
  for (const [key, desc] of Object.entries(TEST_FEATURE_MAP)) {
    if (title.toLowerCase().includes(key)) return desc
  }
  return title
}

async function postToSlack(message) {
  if (!WEBHOOK_URL) { console.log('[triage] No SLACK_WEBHOOK_URL set'); return }
  const body = JSON.stringify({ text: message })
  return new Promise((resolve) => {
    const url = new URL(WEBHOOK_URL)
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      res.resume()
      resolve(res.statusCode)
    })
    req.on('error', (e) => { console.error('[triage] Slack error:', e); resolve(0) })
    req.write(body)
    req.end()
  })
}

async function callClaude(prompt) {
  if (!ANTHROPIC_KEY) throw new Error('No ANTHROPIC_API_KEY')

  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a QA engineer triaging Playwright smoke test failures for Vetree, a veterinary research platform. Be concise and actionable. Return only valid JSON, no markdown fences.',
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(parsed.content?.[0]?.text || '')
        } catch (e) {
          reject(new Error('Failed to parse Anthropic response: ' + data.slice(0, 200)))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  // Read report
  if (!fs.existsSync(REPORT_PATH)) {
    console.log('[triage] No report found, skipping')
    await postToSlack(`⚠️ *Smoke*: Report file not found — tests may have crashed before running. <${RUN_URL}|View run>`)
    return
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'))
  const suites = report.suites || []

  const passed = []
  const skipped = []  // skipped tests are NEVER counted as failed, never sent to triage
  const flaky = []   // passed on final attempt after earlier failure(s)
  const failed = []

  function extractErrLoc(res) {
    // file:line from error.location or errors[].location
    const loc = res?.error?.location || res?.errors?.find(e => e?.location)?.location
    if (!loc) return ''
    return `${String(loc.file).replace(/.*\/e2e\//, 'e2e/')}:${loc.line}`
  }

  function walkSuite(suite) {
    for (const spec of suite.specs || []) {
      for (const result of spec.tests || []) {
        const title = spec.title
        // Use the LAST attempt (final outcome after retries), not [0]
        const attempts = result.results || []
        const res = attempts[attempts.length - 1]
        const finalStatus = res?.status
        // Extract error from error.message OR errors[] — "no error message" is impossible
        const errMsg = res?.error?.message
          || res?.errors?.find(e => e?.message)?.message
          || '(no error message captured)'
        const errLoc = extractErrLoc(res)
        const wasRetried = attempts.length > 1

        if (finalStatus === 'passed') {
          if (wasRetried) flaky.push(title)  // passed only after retry = flaky
          else passed.push(title)
        } else if (finalStatus === 'skipped') {
          skipped.push(title)  // skipped is never a failure
        } else {
          // 'failed', 'timedOut', 'interrupted', etc. — all are failures
          failed.push({ title, error: errMsg.slice(0, 400), loc: errLoc })
        }
      }
    }
    for (const s of suite.suites || []) walkSuite(s)
  }
  for (const suite of suites) walkSuite(suite)

  const triggerLabel = TRIGGER === 'schedule' ? 'daily' : TRIGGER === 'push' ? 'push' : TRIGGER

  // SANITY RULE: Slack verdict must agree with Playwright exit code.
  // failed.length === 0 ↔ GitHub check is green ↔ Slack must say 🟢.
  // If GitHub is green but Slack says 🔴, they disagree — this block prevents that.
  if (failed.length === 0) {
    const parts = [`${passed.length} passed`]
    if (flaky.length > 0) parts.push(`${flaky.length} flaky`)
    if (skipped.length > 0) parts.push(`${skipped.length} skipped`)
    await postToSlack(`🟢 *Smoke*: ${parts.join(', ')} (${triggerLabel}) <${RUN_URL}|→ run>`)
    return
  }

  // Build triage prompt for Claude
  const failedSummary = failed.map(f => {
    const locPart = f.loc ? `\n  Location: ${f.loc}` : ''
    return `• "${f.title}" [${featureFor(f.title)}]${locPart}\n  Error: ${f.error}`
  }).join('\n\n')

  const prompt = `These Playwright smoke tests failed against https://vetree.app:

${failedSummary}

Test→feature map for context:
${Object.entries(TEST_FEATURE_MAP).map(([k,v]) => `  "${k}" → ${v}`).join('\n')}

Return JSON:
{
  "diagnosis": "plain-language diagnosis in 2 sentences",
  "most_likely_cause": "single most likely root cause",
  "fix_prompt": "Ready-to-paste Claude Code fix prompt starting with: Read CLAUDE.md, app/api/CLAUDE.md, supabase/CLAUDE.md first. Then:"
}`

  let diagnosis = 'Claude triage unavailable'
  let mostLikelyCause = ''
  let fixPrompt = ''

  try {
    const raw = await callClaude(prompt)
    // Strip markdown fences per CLAUDE.md rule 7
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(clean)
    diagnosis = parsed.diagnosis || diagnosis
    mostLikelyCause = parsed.most_likely_cause || ''
    fixPrompt = parsed.fix_prompt || ''
  } catch (e) {
    console.error('[triage] Claude error:', e.message)
    // Non-fatal — send plain failure message
  }

  const failedList = failed.map(f => {
    const locPart = f.loc ? ` \`${f.loc}\`` : ''
    return `• ${f.title}${locPart}`
  }).join('\n')

  const redParts = [`${failed.length} failed`, `${passed.length} passed`]
  if (flaky.length > 0) redParts.push(`${flaky.length} flaky`)
  if (skipped.length > 0) redParts.push(`${skipped.length} skipped`)
  let slackMsg = `🔴 *Smoke: ${redParts.join(', ')} (${triggerLabel})*\n\n`
  slackMsg += `*Failed tests:*\n${failedList}\n\n`
  slackMsg += `*Diagnosis:* ${diagnosis}\n`
  if (mostLikelyCause) slackMsg += `*Most likely cause:* ${mostLikelyCause}\n`
  if (fixPrompt) slackMsg += `\n*Fix prompt:*\n\`\`\`\n${fixPrompt}\n\`\`\`\n`
  slackMsg += `\n<${RUN_URL}|View run & traces →>`

  await postToSlack(slackMsg)
}

main().catch(e => {
  console.error('[triage] Fatal:', e)
  process.exit(0) // never fail the job
})
