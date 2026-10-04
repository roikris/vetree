// Shared by both admin "retry failed" controls (/api/enrich-failed and the Article Health
// "Force Retry Failed" action) and by the failed-article counts. Server-only: pass a service-role client.
//
// Only FAILED articles are re-queued: 3+ attempts, a source abstract to enrich from, and not
// published (still queued, missing their AI text, or hidden after failing). A bare
// `enrichment_attempts >= 3` also matched ~320 articles that succeeded on a later attempt and are
// live — re-queuing those hid them and paid to regenerate them.
//
// Articles the enrichment job hid after 3 failures (quarantine_reason 'enrichment_failed',
// migration 072) are un-quarantined HERE, at the admin's request, by a single UPDATE whose WHERE
// re-checks that reason — a quarantine with any other reason (admin, no abstract, unknown) is never
// lifted. Released rows stay hidden anyway (needs_enrichment = true) until a retry completes; if it
// fails again, record_enrichment_failure hides them again.

import type { SupabaseClient } from '@supabase/supabase-js'

export const ENRICHMENT_FAILED = 'enrichment_failed'

/** PostgREST .or() predicate for "failed and not published" (combine with attempts >= 3, abstract not null). */
export const FAILED_UNPUBLISHED_OR =
  `needs_enrichment.eq.true,summary.is.null,clinical_bottom_line.is.null,quarantine_reason.eq.${ENRICHMENT_FAILED}`

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
    // 1. Release only rows that are STILL hidden by the enrichment job (checked by this UPDATE)
    const rel = await admin
      .from('articles')
      .update({ quarantined: false, quarantine_reason: null, needs_enrichment: true, force_retry: true })
      .in('id', batch)
      .eq('quarantined', true)
      .eq('quarantine_reason', ENRICHMENT_FAILED)
      .select('id')
    if (rel.error) throw new Error(`release (after ${requeued} re-queued): ${rel.error.message}`)
    released += rel.data?.length ?? 0
    // 2. Re-queue the batch (any other quarantine untouched)
    const rq = await admin
      .from('articles')
      .update({ needs_enrichment: true, force_retry: true })
      .in('id', batch)
      .select('id')
    if (rq.error) throw new Error(`requeue (after ${requeued} re-queued): ${rq.error.message}`)
    requeued += rq.data?.length ?? 0
  }
  return { requeued, released }
}
