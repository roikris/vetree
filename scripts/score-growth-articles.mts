// Backfill Growth OS relevance scores for every eligible article (lib/growth/scoring.ts).
// Resumable and cache-aware: only articles without a valid score (current rubric + unchanged
// input) are scored, so re-running after an interruption picks up where it stopped.
// WRITES TO PRODUCTION (growth_article_scores) — run only with the owner's go-ahead.
//
//   set -a && source .env.local && set +a && npx tsx scripts/score-growth-articles.mts
import { createClient } from '@supabase/supabase-js'
import { rankGrowthCandidates } from '../lib/growth/candidates'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
let previous = -1
for (;;) {
  const { ranked, scoredCount, scoringErrors } = await rankGrowthCandidates(supabase, {
    scoreMissing: { max: 100, deadline: Date.now() + 180_000 },
  })
  console.log(`scored ${scoredCount}/${ranked.length}${scoringErrors.length ? ` — ${scoringErrors.length} batch errors: ${scoringErrors[0]}` : ''}`)
  if (scoredCount >= ranked.length) break
  if (scoredCount === previous) { console.log('no progress — stopping'); process.exit(1) }
  previous = scoredCount
}
