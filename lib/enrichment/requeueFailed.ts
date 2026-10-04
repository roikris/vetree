// Shared by both admin "retry failed" controls (/api/enrich-failed and the Article Health
// "Force Retry Failed" action). Server-only: pass a service-role client.
//
// Only FAILED articles are re-queued: 3+ attempts, a source abstract to enrich from, and not
// published (still queued, missing their AI text, or hidden after failing). A bare
// `enrichment_attempts >= 3` also matched ~320 articles that succeeded on a later attempt and are
// live — re-queuing those hid them and paid to regenerate them.
//
// Articles the enrichment job hid after 3 failures (error starting ENRICHMENT_FAILED_3X) are
// un-quarantined HERE, at the admin's request, while that marker is still intact. They stay hidden
// anyway (needs_enrichment = true) until a retry completes; if it fails again the job hides them
// again. No other quarantine is ever lifted.

import type { SupabaseClient } from '@supabase/supabase-js'

export const ENRICHMENT_FAILED_3X = 'enrichment_failed_3x'   // keep in step with enrich-articles.js

export async function requeueFailedArticles(admin: SupabaseClient): Promise<{ requeued: number; released: number }> {
  const rows: { id: string; quarantined: boolean | null; last_enrichment_error: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('articles')
      .select('id, quarantined, last_enrichment_error')
      .gte('enrichment_attempts', 3)
      .not('abstract', 'is', null)
      .or(`needs_enrichment.eq.true,summary.is.null,clinical_bottom_line.is.null,last_enrichment_error.like.${ENRICHMENT_FAILED_3X}*`)
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(`select failed articles: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }

  const release = rows.filter(r => r.quarantined && (r.last_enrichment_error || '').startsWith(ENRICHMENT_FAILED_3X)).map(r => r.id)
  const keep = rows.filter(r => !release.includes(r.id)).map(r => r.id)

  for (const [ids, extra] of [[keep, {}], [release, { quarantined: false }]] as const) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await admin
        .from('articles')
        .update({ needs_enrichment: true, force_retry: true, ...extra })
        .in('id', ids.slice(i, i + 200))
      if (error) throw new Error(`requeue: ${error.message}`)
    }
  }
  return { requeued: rows.length, released: release.length }
}
