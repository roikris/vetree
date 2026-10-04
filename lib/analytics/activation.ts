// Activation measures (Batch C #12) — "did new readers get value, and did they come back?"
//
// Definitions (also in CLAUDE.md → Metrics):
//   Cohort        confirmed accounts (email_confirmed_at set), admin + TEST_USER_ID excluded, that
//                 signed up in [now − days − 7d, now − 7d) — so every member has had a full 7 days
//   First save    member saved ≥ 1 article between signup and 7 days after (saved_articles.saved_at).
//                 A lower bound: unsaving deletes the row.
//   Return visit  member has a human page view (bot_name null) on a later UTC calendar day than
//                 their signup day, within 7 days (can be minutes later, across midnight)
//   Returning anonymous visitors  of the visitor hashes (ip_hash, signed-out, human) seen in the
//                 last `days`, the share seen on ≥ 2 distinct UTC days. Approximate: mobile IPs change.
// Test traffic: analytics writers record only in production and skip QA traffic since 2026-09-29;
// earlier rows may include it (search_logs before 2026-09-27 certainly do).

import type { SupabaseClient } from '@supabase/supabase-js'
import { EXCLUDED_USER_IDS, excludedUsersOrFilter } from '@/lib/analytics-excluded-ids'

const DAY = 24 * 60 * 60 * 1000
export const ACTIVATION_RELIABLE_FROM = '2026-09-29'

export type ActivationMetrics = {
  cohortFrom: string
  cohortTo: string
  cohortSize: number
  firstSave: number          // members who saved within 7 days
  returned: number           // members back on a later day within 7 days
  anonVisitors: number
  anonReturning: number
}

async function readAll<T>(label: string, page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw new Error(`[activation] ${label}: ${error.message}`)
    out.push(...(data || []))
    if (!data || data.length < 1000) return out
  }
}

const utcDay = (iso: string) => iso.slice(0, 10)

export async function computeActivation(db: SupabaseClient, days: number, now = Date.now()): Promise<ActivationMetrics> {
  const cohortTo = new Date(now - 7 * DAY)
  const cohortFrom = new Date(cohortTo.getTime() - days * DAY)

  // Cohort from the auth admin API (auth.users isn't reachable through PostgREST)
  const cohort: { id: string; created: number }[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`[activation] users: ${error.message}`)
    for (const u of data.users) {
      const created = Date.parse(u.created_at)
      if (u.email_confirmed_at && !EXCLUDED_USER_IDS.includes(u.id) && created >= cohortFrom.getTime() && created < cohortTo.getTime()) {
        cohort.push({ id: u.id, created })
      }
    }
    if (data.users.length < 1000) break
  }

  let firstSave = 0
  let returned = 0
  if (cohort.length > 0) {
    const windowEnd = new Date(cohortTo.getTime() + 7 * DAY).toISOString()
    // Per-user timestamps, fetched in chunks of 100 ids (a full id list would outgrow the request URL)
    const saveTimes = new Map<string, number[]>()
    const viewTimes = new Map<string, string[]>()
    for (let i = 0; i < cohort.length; i += 100) {
      const ids = cohort.slice(i, i + 100).map(c => c.id)
      const saves = await readAll<{ user_id: string; saved_at: string }>('saves', (f, t) =>
        db.from('saved_articles').select('user_id, saved_at').in('user_id', ids)
          .gte('saved_at', cohortFrom.toISOString()).lt('saved_at', windowEnd)
          .order('saved_at').order('user_id').order('article_id').range(f, t))
      for (const sv of saves) saveTimes.set(sv.user_id, [...(saveTimes.get(sv.user_id) ?? []), Date.parse(sv.saved_at)])
      const views = await readAll<{ user_id: string; created_at: string }>('views', (f, t) =>
        db.from('page_views').select('user_id, created_at').in('user_id', ids).is('bot_name', null)
          .gte('created_at', cohortFrom.toISOString()).lt('created_at', windowEnd)
          .order('created_at').order('id').range(f, t))
      for (const v of views) viewTimes.set(v.user_id, [...(viewTimes.get(v.user_id) ?? []), v.created_at])
    }
    for (const c of cohort) {
      const end = c.created + 7 * DAY
      if ((saveTimes.get(c.id) ?? []).some(t => t >= c.created && t < end)) firstSave++
      const signupDay = utcDay(new Date(c.created).toISOString())
      if ((viewTimes.get(c.id) ?? []).some(iso => Date.parse(iso) < end && utcDay(iso) > signupDay)) returned++
    }
  }

  // Signed-out visitors: distinct days per visitor hash in the window
  const since = new Date(now - days * DAY).toISOString()
  const anon = await readAll<{ ip_hash: string | null; created_at: string }>('anonymous views', (f, t) =>
    db.from('page_views').select('ip_hash, created_at').is('user_id', null).is('bot_name', null)
      .not('ip_hash', 'is', null).gte('created_at', since).or(excludedUsersOrFilter())
      .order('created_at').order('id').range(f, t))
  const daysByVisitor = new Map<string, Set<string>>()
  for (const v of anon) {
    if (!v.ip_hash) continue
    const set = daysByVisitor.get(v.ip_hash) ?? new Set<string>()
    set.add(utcDay(v.created_at))
    daysByVisitor.set(v.ip_hash, set)
  }

  return {
    cohortFrom: utcDay(cohortFrom.toISOString()),
    cohortTo: utcDay(cohortTo.toISOString()),
    cohortSize: cohort.length,
    firstSave,
    returned,
    anonVisitors: daysByVisitor.size,
    anonReturning: [...daysByVisitor.values()].filter(s => s.size >= 2).length,
  }
}
