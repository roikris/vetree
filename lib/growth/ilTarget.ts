// vetree.app/il → where to send the reader (app/il/route.ts, social-001). Kept free of Next.js so it can be tested
// offline (tests/unit/ilTarget.test.ts). Every day ONE article is posted to EVERY platform, so today's article = the
// newest 'approved' growth_agent_memory row with an article, whatever its platform label. Only the daily posts may write
// such rows (synthesis posts carry no article; recommendation dismissals use other outcomes; the unused Content Agent
// tab's Approve still does until growth-002 removes it) — keep it that way, or this opens the wrong article.

// The query surface used here — a Supabase client satisfies it; tests pass a recording fake
type Result<T> = PromiseLike<{ data: T | null; error: { code?: string } | null }>
type Row = { article_id?: string | null; id?: string }
export interface IlFilter {
  eq(column: string, value: unknown): IlFilter
  not(column: string, operator: string, value: unknown): IlFilter
  or(filter: string): IlFilter
  order(column: string, options: { ascending: boolean }): IlFilter
  limit(count: number): IlFilter
  maybeSingle(): Result<Row>
}
export interface IlClient {
  from(table: string): { select(columns: string): IlFilter }
}

/** The newest article marked as posted on any platform, or null when there is none. Throws on a read error. */
export async function latestPostedArticleId(db: IlClient): Promise<string | null> {
  const { data, error } = await db
    .from('growth_agent_memory')
    .select('article_id')
    .eq('outcome', 'approved')
    .not('article_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`growth_agent_memory read failed (${error.code})`)
  return data?.article_id ?? null
}

/** True when readers can see the article (Public Article Filter, supabase/CLAUDE.md). Throws on a read error. */
export async function isPublicArticle(db: IlClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from('articles')
    .select('id')
    .eq('id', id)
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')
    .maybeSingle()
  if (error) throw new Error(`articles read failed (${error.code})`)
  return !!data
}

export type IlDeps = {
  limit: () => Promise<{ success: boolean }>
  db: () => IlClient
  report: (e: unknown) => void
}

/**
 * The path to send the reader to: today's article, or the home page when rate-limited, nothing is posted yet, the
 * article is hidden, or anything fails (the limiter included) — reported, never an error page.
 */
export async function resolveIlPath(deps: IlDeps): Promise<string> {
  try {
    const { success } = await deps.limit()
    if (!success) return '/'
    const db = deps.db()
    const id = await latestPostedArticleId(db)
    if (!id) return '/'
    if (!(await isPublicArticle(db, id))) return '/'
    return `/article/${encodeURIComponent(id)}`
  } catch (e) {
    deps.report(e)
    return '/'
  }
}
