// "Posted" records (growth_agent_memory, outcome 'approved') for the daily posts (growth-002). Kept free of Next.js so
// it can be tested offline (tests/unit/approvals.test.ts); a Supabase client satisfies the small query surface.
import { israelDate, israelDayBounds } from './daily'

type Result<T> = PromiseLike<{ data: T | null; error: { message?: string } | null }>
export interface ApprovalFilter {
  eq(column: string, value: unknown): ApprovalFilter
  gte(column: string, value: string): ApprovalFilter
  lt(column: string, value: string): ApprovalFilter
  order(column: string, options: { ascending: boolean }): ApprovalFilter
  limit(count: number): ApprovalFilter
  maybeSingle(): Result<{ id: string }>
}
export interface ApprovalClient {
  from(table: string): { select(columns: string): ApprovalFilter }
}

/**
 * The approved row already recorded for this article + platform on the Israel day of `now`, or null. One row per
 * day: a second Copy & mark posted (another click, a reload, another browser) reuses it; a later day is a new row.
 * Throws on a read error.
 */
export async function approvedRowToday(db: ApprovalClient, articleId: string, platform: string, now: Date): Promise<{ id: string } | null> {
  const { start, end } = israelDayBounds(israelDate(now))
  const { data, error } = await db
    .from('growth_agent_memory')
    .select('id')
    .eq('article_id', articleId)
    .eq('platform', platform)
    .eq('outcome', 'approved')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`growth_agent_memory read failed (${error.message})`)
  return data
}

/**
 * The client-side guard against double clicks within one page: concurrent calls for the same key share one write; a
 * success is remembered; a failure lets the next click try again. (Across reloads the server dedups — above.)
 */
export function onceGuard<T>(write: (key: string) => Promise<T | null>) {
  const inFlight = new Map<string, Promise<T | null>>()
  return (key: string): Promise<T | null> => {
    const existing = inFlight.get(key)
    if (existing) return existing
    const p = write(key).then(r => {
      if (r === null) inFlight.delete(key)
      return r
    }, e => {
      inFlight.delete(key)
      throw e
    })
    inFlight.set(key, p)
    return p
  }
}
