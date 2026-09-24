/**
 * One-off cleanup: delete quarantined articles and blacklist them so the daily
 * PubMed sync does not re-import and re-enrich them.
 *
 * Context (verified 2026-09-23):
 *   541 quarantined articles, none referenced by saved_articles, growth_agent_memory,
 *   linkedin_post_metrics or digest_sent_articles. Breakdown by last_enrichment_error:
 *     - no_abstract                      311  never had an abstract; cannot be enriched
 *     - hallucinated_summary_no_abstract 217  summary field holds the model's refusal
 *                                             text ("I cannot provide an accurate
 *                                             analysis..."), which rendered on the live
 *                                             article page
 *     - content_policy_refusal            13  livestock/poultry virology; excluded from
 *                                             every user-facing surface by the
 *                                             large-animal rule regardless of enrichment
 *
 * Order is deliberate: blacklist FIRST, then delete. If the run is interrupted between
 * the two, a blacklisted-but-still-present article is harmless and the script is safe to
 * re-run. The reverse order would leave articles deleted but re-importable on the next sync.
 *
 * Blacklist keys on the bare `pubmed_id` ("42419362"), not the article id
 * ("pubmed-42419362") — that is what daily-sync.js:373 checks against.
 *
 * Usage:
 *   npx tsx scripts/purge-quarantined-articles.ts              # dry run, prints plan
 *   npx tsx scripts/purge-quarantined-articles.ts --apply      # executes
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const APPLY = process.argv.includes('--apply')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Tables holding an article_id FK. Re-checked at run time rather than trusting an
// earlier manual check — if anything now references a row we are about to delete,
// abort instead of cascading or erroring mid-run.
const REFERENCING_TABLES = [
  'saved_articles',
  'growth_agent_memory',
  'linkedin_post_metrics',
  'digest_sent_articles',
  'analytics_events',
]

async function main() {
  const { data: targets, error } = await supabase
    .from('articles')
    .select('id, pubmed_id, last_enrichment_error')
    .eq('quarantined', true)

  if (error) throw new Error(`select failed: ${error.message}`)
  if (!targets?.length) {
    console.log('No quarantined articles found. Nothing to do.')
    return
  }

  const byReason = targets.reduce<Record<string, number>>((acc, a) => {
    const k = a.last_enrichment_error ?? 'none'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})

  console.log(`Quarantined articles targeted: ${targets.length}`)
  for (const [reason, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${reason}`)
  }

  const targetIds = new Set(targets.map(a => a.id))
  let blocked = 0
  for (const table of REFERENCING_TABLES) {
    const { data, error: refErr } = await supabase.from(table).select('article_id')
    if (refErr) throw new Error(`reference check on ${table} failed: ${refErr.message}`)
    const hits = (data ?? []).filter(r => r.article_id && targetIds.has(r.article_id)).length
    console.log(`  reference check — ${table}: ${hits}`)
    blocked += hits
  }

  if (blocked > 0) {
    console.error(`\nABORT: ${blocked} rows reference articles slated for deletion.`)
    console.error('Resolve those references before purging; refusing to cascade.')
    process.exit(1)
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to execute.')
    console.log(`Would blacklist ${targets.length} pubmed_ids, then delete ${targets.length} articles.`)
    return
  }

  const rows = targets.map(a => ({
    pubmed_id: a.pubmed_id,
    reason: 'admin_deleted',
    blacklisted_at: new Date().toISOString(),
  }))

  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const { error: blErr } = await supabase
      .from('articles_blacklist')
      .upsert(chunk, { onConflict: 'pubmed_id', ignoreDuplicates: true })
    if (blErr) throw new Error(`blacklist insert failed at offset ${i}: ${blErr.message}`)
  }
  console.log(`Blacklisted ${rows.length} pubmed_ids.`)

  const ids = targets.map(a => a.id)
  let deleted = 0
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const { error: delErr, count } = await supabase
      .from('articles')
      .delete({ count: 'exact' })
      .in('id', chunk)
    if (delErr) throw new Error(`delete failed at offset ${i}: ${delErr.message}`)
    deleted += count ?? 0
  }
  console.log(`Deleted ${deleted} articles.`)

  const { count: remaining } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('quarantined', true)
  console.log(`Quarantined remaining: ${remaining ?? 0} (expected 0)`)
}

main().catch(e => {
  console.error(e.message)
  process.exit(1)
})
