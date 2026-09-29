import type { SupabaseClient } from '@supabase/supabase-js'
import { excludedUsersOrFilter } from '@/lib/analytics-excluded-ids'
import type { SynthesisEvent } from '@/lib/analytics/recording'

/**
 * Human synthesis events in [from, to): analytics_events rows with that event_name, excluding
 * crawlers (bot_name), traffic classified as suspected test traffic (traffic_class, migration 065)
 * and the admin + TEST_USER_ID accounts. Server-only (service-role client). Throws on error — a
 * failed count must never read as zero.
 */
export async function countSynthesisEvents(
  supabase: SupabaseClient,
  event: SynthesisEvent,
  from: string,
  to?: string,
): Promise<number> {
  let q = supabase.from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_name', event)
    .is('bot_name', null)
    .is('traffic_class', null)
    .or(excludedUsersOrFilter())
    .gte('created_at', from)
  if (to) q = q.lt('created_at', to)
  const { count, error } = await q
  if (error) throw new Error(`synthesis event count (${event}) failed: ${error.message}`)
  return count ?? 0
}

/**
 * When synthesis events were moved out of page_views (migration 065, first successful
 * move_synthesis_page_views() that moved rows), as YYYY-MM-DD (UTC) — or null if not yet run.
 * Snapshots dated before it include the synthetic page views and some test traffic.
 */
export async function getAnalyticsCleanupBoundary(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from('analytics_maintenance_log')
    .select('ran_at, details')
    .eq('action', 'synthesis_events_moved')
    .order('ran_at', { ascending: true })
  if (error || !data) return null
  const first = data.find(r => Number((r.details as { moved?: number } | null)?.moved ?? 0) > 0)
  return first ? String(first.ran_at).slice(0, 10) : null
}
