// One-off repair for the article_id/match_method wipe caused by the XLSX
// upload's on-conflict upsert (fixed in fix/xlsx-upsert-preserves-assignments).
//
// Finds rows where the upload nulled a previously-assigned article_id/match_method,
// runs them through the same tiered matcher used by /api/admin/linkedin-metrics/rematch
// (activity_id -> slug -> date -> AI), and writes back ONLY article_id/match_method
// for rows that re-match. Never touches metric columns. Rows that still can't be
// matched are printed for manual re-assignment via the admin picker.
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { matchArticlesToPosts } from '../lib/linkedin/matchArticle'

config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function repair() {
  console.log('Finding rows with article_id IS NULL AND match_method IS NULL...\n')

  const { data: broken, error: fetchError } = await supabase
    .from('linkedin_post_metrics')
    .select('id, post_url, post_date, metrics_updated_at')
    .is('article_id', null)
    .is('match_method', null)

  if (fetchError) {
    console.error('Fetch failed:', fetchError.message)
    process.exit(1)
  }
  if (!broken || broken.length === 0) {
    console.log('No broken rows found. Nothing to repair.')
    return
  }

  console.log(`Found ${broken.length} row(s) with both columns nulled:`)
  for (const row of broken) console.log(`  - ${row.post_url}  (${row.post_date}, updated ${row.metrics_updated_at})`)
  console.log()

  const { data: linkedinMemory } = await supabase
    .from('growth_agent_memory')
    .select('id, article_id, hook_line, created_at, posted_url')
    .eq('platform', 'linkedin')
    .eq('outcome', 'approved')

  const postsToMatch = broken
    .filter(r => r.post_url)
    .map(r => ({ key: r.id, url: r.post_url!, post_date: r.post_date }))

  const matchMap = await matchArticlesToPosts(postsToMatch, linkedinMemory ?? [])

  let restored = 0
  const restoredBreakdown: Record<string, number> = {}
  const stillUnmatched: typeof broken = []

  for (const row of broken) {
    const match = matchMap.get(row.id)
    if (!match) {
      stillUnmatched.push(row)
      continue
    }
    const { error } = await supabase
      .from('linkedin_post_metrics')
      .update({ article_id: match.article_id, match_method: match.method })
      .eq('id', row.id)
    if (error) {
      console.error(`  Update failed for ${row.post_url}: ${error.message}`)
      stillUnmatched.push(row)
      continue
    }
    restored++
    restoredBreakdown[match.method] = (restoredBreakdown[match.method] ?? 0) + 1
  }

  console.log(`\nRestored ${restored} row(s) via matcher:`, restoredBreakdown)
  console.log(`\n${stillUnmatched.length} row(s) could not be auto-restored — needs Roi's manual re-assignment via the picker:`)
  console.log('post_url, post_date')
  for (const row of stillUnmatched) console.log(`${row.post_url}, ${row.post_date}`)
}

repair().catch(err => {
  console.error(err)
  process.exit(1)
})
