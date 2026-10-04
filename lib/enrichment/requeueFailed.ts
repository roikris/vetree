// Shared by both admin "retry failed" controls (/api/enrich-failed and the Article Health
// "Force Retry Failed" action) and by the failed-article counts. Server-only: pass a service-role client.
//
// Only FAILED articles are re-queued: 3+ attempts, a source abstract to enrich from, and not
// published (still queued, missing their AI text, or hidden after failing). A bare
// `enrichment_attempts >= 3` also matched ~320 articles that succeeded on a later attempt and are
// live — re-queuing those hid them and paid to regenerate them.
//
// Articles the enrichment job hid after 3 failures (error starting ENRICHMENT_FAILED_3X) are
// un-quarantined HERE, at the admin's request — with the quarantine + marker conditions re-checked
// by the UPDATE itself, so a quarantine someone else set in the meantime is never lifted. They stay
// hidden anyway (needs_enrichment = true) until a retry completes; if it fails again the job hides
// them again. No other quarantine is ever lifted.

import type { SupabaseClient } from '@supabase/supabase-js'

// Hyphens, not underscores: "_" is a wildcard in SQL LIKE. Keep in step with enrich-articles.js.
export const ENRICHMENT_FAILED_3X = 'enrichment-failed-3x'
export const MARKER_LIKE = `${ENRICHMENT_FAILED_3X}*`   // PostgREST: * = %

/** PostgREST .or() predicate for "failed and not published" (combine with attempts >= 3). */
export const FAILED_UNPUBLISHED_OR =
  `needs_enrichment.eq.true,summary.is.null,clinical_bottom_line.is.null,last_enrichment_error.like.${MARKER_LIKE}`

export async function requeueFailedArticles(admin: SupabaseClient): Promise<{ requeued: number; released: number }> {
  const ids: string[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('articles')
      .select('id')
      .gte('enrichment_attempts', 3)
      .not('abstract', 'is', null)
      .or(FAILED_UNPUBLISHED_OR)
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(`select failed articles: ${error.message}`)
    ids.push(...(data || []).map(r => r.id))
    if (!data || data.length < 1000) break
  }

  let requeued = 0
  let released = 0
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200)
    // 1. Release only rows that are STILL quarantined with the job's marker (checked at write time)
    const rel = await admin
      .from('articles')
      .update({ quarantined: false, needs_enrichment: true, force_retry: true })
      .in('id', batch)
      .eq('quarantined', true)
      .like('last_enrichment_error', `${ENRICHMENT_FAILED_3X}%`)
      .select('id')
    if (rel.error) throw new Error(`release: ${rel.error.message}`)
    released += rel.data?.length ?? 0
    // 2. Re-queue the batch (quarantine untouched)
    const rq = await admin
      .from('articles')
      .update({ needs_enrichment: true, force_retry: true })
      .in('id', batch)
      .select('id')
    if (rq.error) throw new Error(`requeue: ${rq.error.message}`)
    requeued += rq.data?.length ?? 0
  }
  return { requeued, released }
}
