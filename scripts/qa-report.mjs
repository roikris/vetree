#!/usr/bin/env node
/**
 * qa-report.mjs
 * Reads playwright-results.json, optionally triages failures with Claude Haiku,
 * then sends a Slack summary. Called by the qa-smoke.yml workflow.
 */
import { readFileSync, existsSync } from 'fs'

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const TEST_OUTCOME = process.env.TEST_OUTCOME || 'unknown'

// ─── Parse Playwright JSON results ───────────────────────────────────────────

function parseResults(filePath) {
  if (!existsSync(filePath)) {
    return { passed: 0, total: 0, duration: 0, failures: [], parseError: 'playwright-results.json not found' }
  }

  const raw = JSON.parse(readFileSync(filePath, 'utf8'))
  const stats = raw.stats || {}
  const passed = stats.expected ?? 0
  const total = (stats.expected ?? 0) + (stats.unexpected ?? 0) + (stats.flaky ?? 0)
  const durationMs = stats.duration ?? 0

  const failures = []
  function walkSuites(suites) {
    for (const suite of suites || []) {
      walkSuites(suite.suites)
      for (const t of suite.tests || []) {
        if (t.status === 'unexpected') {
          const lastResult = t.results?.[t.results.length - 1] || {}
          const errorMsg = lastResult.errors?.[0]?.message || lastResult.errors?.[0]?.value || 'No error message'
          failures.push({
            title: t.title,
            error: errorMsg.slice(0, 600), // cap length for Claude prompt
          })
        }
      }
    }
  }
  walkSuites(raw.suites)

  return { passed, total, duration: Math.round(durationMs / 1000), failures }
}

// ─── Call Claude Haiku for triage ─────────────────────────────────────────────

async function triageFailures(failures) {
  if (!ANTHROPIC_API_KEY || failures.length === 0) return null

  // Initialise client inside the function (never at module level — CLAUDE.md rule)
  const { Anthropic } = await import('@anthropic-ai/sdk')
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  const failureText = failures
    .map(f => `Test: ${f.title}\nError: ${f.error}`)
    .join('\n\n---\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system:
      'You are a QA triage assistant for Vetree (Next.js 16 App Router + Supabase). ' +
      'Given failed Playwright smoke tests against https://vetree.app, diagnose the most likely cause ' +
      'in 2-3 sentences and write a ready-to-paste Claude Code fix prompt. ' +
      'Be concise. Format: "Diagnosis: …\n\nFix prompt: …"',
    messages: [
      {
        role: 'user',
        content: `These Playwright smoke tests failed:\n\n${failureText}`,
      },
    ],
  })

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
  return raw.trim()
}

// ─── Send Slack message ───────────────────────────────────────────────────────

async function sendSlack(text) {
  if (!SLACK_WEBHOOK_URL) {
    console.error('[qa-report] SLACK_WEBHOOK_URL not set — skipping Slack notification')
    return
  }
  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    console.error('[qa-report] Slack webhook failed:', res.status, await res.text())
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { passed, total, duration, failures, parseError } = parseResults('playwright-results.json')

  if (parseError) {
    await sendSlack(
      `🧪 *Vetree Daily QA Report*\n` +
      `• Status: ❌ Could not parse results (${parseError})\n` +
      `• TEST_OUTCOME: ${TEST_OUTCOME}`
    )
    process.exit(1)
  }

  const allPassed = failures.length === 0
  const statusLine = allPassed
    ? `✅ All clear`
    : `❌ ${failures.length} failure${failures.length > 1 ? 's' : ''}`

  let message =
    `🧪 *Vetree Daily QA Report*\n` +
    `• Tests passed: ${passed}/${total}\n` +
    `• Duration: ${duration}s\n` +
    `• Status: ${statusLine}`

  if (!allPassed) {
    message += `\n\n*Failed tests:*`
    for (const f of failures) {
      message += `\n  — \`${f.title}\``
    }

    const triage = await triageFailures(failures)
    if (triage) {
      message += `\n\n*Claude Haiku triage:*\n${triage}`
    }
  }

  console.log('[qa-report]', message)
  await sendSlack(message)

  if (!allPassed) process.exit(1)
}

main().catch(err => {
  console.error('[qa-report] Fatal error:', err)
  process.exit(1)
})
