import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
// Server only: lib/supabase/server.ts imports next/headers, so a client component importing this fails the build.
// Not a 'use server' module on purpose — an action would be callable from any browser, and this uses the service role.
import { createAdminClient } from '@/lib/supabase/server'
import {
  HOUR_MS, loadSavedThisWeek,
  type ArticleRow, type SaveCount, type SavedThisWeekArticle, type SavedThisWeekDeps,
} from './savedThisWeekCore'

type Clients = { admin: () => SupabaseClient; anon: () => SupabaseClient }
const realClients: Clients = {
  admin: createAdminClient,
  // Public rows only: the anon key, no cookies
  anon: () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
}

/** The real data sources for one fill, all under one deadline (exported for tests/unit/savedThisWeek.test.ts). */
export function savedThisWeekDeps(signal: AbortSignal, clients: Clients = realClients): SavedThisWeekDeps {
  return {
    // Loaded here, not at the top: the helper validates TEST_USER_ID when it loads, and must not break the page
    excludedIds: async () => (await import('@/lib/analytics-excluded-ids')).EXCLUDED_USER_IDS,
    countSaves: async ({ since, until, excluded, limit }) => {
      const { data, error } = await clients.admin()
        .rpc('saved_this_week', { p_since: since, p_until: until, p_excluded: excluded, p_limit: limit })
        .abortSignal(signal)
      if (error) throw new Error(`saved_this_week failed: ${error.message}`)
      return (data ?? []) as SaveCount[]
    },
    fetchArticles: async (ids) => {
      const { data, error } = await clients.anon()
        .from('articles')
        .select('id, title, clinical_bottom_line, labels, source_journal')
        .in('id', ids)
        .eq('needs_enrichment', false)
        .not('summary', 'is', null)
        .not('clinical_bottom_line', 'is', null)
        .or('quarantined.is.null,quarantined.eq.false')
        .abortSignal(signal)
      if (error) throw new Error(`saved-this-week articles failed: ${error.message}`)
      return (data ?? []) as ArticleRow[]
    },
  }
}

/**
 * The homepage "Articles saved this week" section (feed-002): every reader's saves in the 7 days before the current
 * UTC hour, admin + test account excluded — the same list for every visitor. Counted in SQL by
 * public.saved_this_week() (migration 083, service role only); article ids and counts only, never who saved.
 * Cached per UTC hour (the hour is the cache key, like "new this week" in publicStats.ts): normally one fill an
 * hour, so a save shows up within the hour. A failed fill throws — nothing is cached — and the section is hidden.
 */
const cached = unstable_cache(
  // One deadline for the whole fill; a failure throws, so nothing is cached
  async (hour: number): Promise<SavedThisWeekArticle[]> => loadSavedThisWeek(hour, savedThisWeekDeps(AbortSignal.timeout(3000))),
  ['saved-this-week'],
  { revalidate: 7200 }   // entries are never reused after their hour; this only lets old ones expire
)

/** Never throws: [] (section hidden) on any failure. */
export async function getSavedThisWeek(): Promise<SavedThisWeekArticle[]> {
  try {
    return await cached(Math.floor(Date.now() / HOUR_MS))
  } catch (e) {
    console.error('[savedThisWeek]', e instanceof Error ? e.message : e)
    return []
  }
}
