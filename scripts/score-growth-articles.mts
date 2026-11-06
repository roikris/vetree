// Score Growth OS candidates that have no valid relevance score yet (lib/growth/scoring.ts).
// Runs daily in enrich-articles.yml right after enrichment (growth-004), so the recommendations panel and the
// auto-pick only read cached scores. Resumable and cache-aware: only articles without a valid score (current
// rubric + unchanged input) are scored, so a re-run picks up where the last one stopped.
// WRITES TO PRODUCTION (growth_article_scores) and makes paid Claude calls (~10 articles per call).
//
//   CI:    the "score" job of enrich-articles.yml (manual run: Actions → Enrich Articles → Run workflow)
//   Local: set -a && source .env.local && set +a && npx tsx scripts/score-growth-articles.mts
//
// Exit 1 (workflow red, Slack alert) when articles are still unscored at the end, or a round makes no progress.
import { createClient } from '@supabase/supabase-js'
import { rankGrowthCandidates } from '../lib/growth/candidates'

const TOTAL_BUDGET_MS = 15 * 60_000
const ROUND_MS = 180_000

async function slack(text: string) {
  const hook = process.env.SLACK_WEBHOOK_URL
  if (!hook) return
  try {
    const res = await fetch(hook, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.error(`Slack post failed: HTTP ${res.status}`)
  } catch (e) {
    console.error('Slack post failed:', e)
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || !process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANTHROPIC_API_KEY')
  }
  const supabase = createClient(url, key)
  const stopAt = Date.now() + TOTAL_BUDGET_MS
  let previous = -1
  let firstError = ''
  for (;;) {
    const { ranked, scoredCount, scoringErrors, degraded } = await rankGrowthCandidates(supabase, {
      scoreMissing: { max: 100, deadline: Math.min(Date.now() + ROUND_MS, stopAt) },
    })
    if (scoringErrors.length && !firstError) firstError = scoringErrors[0]
    console.log(`scored ${scoredCount}/${ranked.length}${scoringErrors.length ? ` — ${scoringErrors.length} batch errors: ${scoringErrors[0]}` : ''}`)
    if (scoredCount >= ranked.length) return
    const unscored = ranked.length - scoredCount
    const stuck = degraded || scoredCount === previous
    if (stuck || Date.now() >= stopAt - 15_000) {
      const why = stuck ? 'no progress' : 'out of time'
      console.error(`${why} — ${unscored} eligible articles still unscored`)
      await slack(`:warning: Growth OS scoring: ${unscored} eligible articles still have no relevance score (${why}).`
        + `${firstError ? ` First error: ${firstError.slice(0, 300)}` : ''} They rank last in the recommendations until scored.`)
      process.exit(1)
    }
    previous = scoredCount
  }
}

main().catch(async e => {
  console.error(e)
  await slack(`:x: Growth OS scoring failed: ${String(e).slice(0, 300)}`)
  process.exit(1)
})
