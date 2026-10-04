// Shared by both admin "retry failed" controls (/api/enrich-failed and the Article Health
// "Force Retry Failed" action) and by the failed-article counts. Server-only: pass a service-role client.
//
// "Retry failed" is the database function requeue_failed_articles() (migration 072): ONE update,
// re-checked on each row's current version, that re-queues failed, unpublished articles with a
// source abstract — 3+ attempts, or hidden by the enrichment job whatever the attempt count says —
// and lifts only the 'enrichment_failed' quarantine (never an admin's, a no-abstract or an unknown
// one). A bare `enrichment_attempts >= 3` used to also match ~320 live articles that succeeded on
// a later attempt: re-queuing those hid them and paid to regenerate them.

import type { SupabaseClient } from '@supabase/supabase-js'

export const ENRICHMENT_FAILED = 'enrichment_failed'

/**
 * PostgREST .or() for the same set requeue_failed_articles() retries (combine with abstract not null):
 * hidden by the enrichment job, or 3+ attempts and not published.
 */
export const FAILED_UNPUBLISHED_OR =
  `quarantine_reason.eq.${ENRICHMENT_FAILED},and(enrichment_attempts.gte.3,or(needs_enrichment.eq.true,summary.is.null,clinical_bottom_line.is.null))`

export async function requeueFailedArticles(admin: SupabaseClient): Promise<{ requeued: number; released: number }> {
  const { data, error } = await admin.rpc('requeue_failed_articles')
  if (error) throw new Error(`requeue_failed_articles: ${error.message}`)
  const row = (Array.isArray(data) ? data[0] : data) as { requeued: number; released: number } | null
  return { requeued: row?.requeued ?? 0, released: row?.released ?? 0 }
}
