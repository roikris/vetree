// How the December trial's article of the day was chosen (growth-006, Roi 2026-11-24 "logging only").
// The 🧪 tab records it on each trial post (growth_trial_posts.pick_source, migration 091) so the January analysis can
// compare outcomes by how the article was picked. The ranking itself is not logged here: each article's scores are in
// growth_article_scores and every recommendation list shown is in growth_recommendation_sets.

export const PICK_SOURCES = ['auto', 'recommendation', 'search', 'unknown'] as const
export type PickSource = (typeof PICK_SOURCES)[number]

/** The panel's record of how the day's article was chosen — always bound to that article. */
export type Pick = { articleId: string; source: PickSource }

/** Server side: anything that isn't a known source becomes 'unknown' (the value is client-reported, admin only). */
export function normalizePickSource(value: unknown): PickSource {
  return typeof value === 'string' && (PICK_SOURCES as readonly string[]).includes(value) ? value as PickSource : 'unknown'
}

/** The source to send when marking `articleId` — only a pick made for that same article counts. */
export function pickSourceFor(pick: Pick | null | undefined, articleId: string | null): PickSource | undefined {
  return pick && articleId && pick.articleId === articleId ? pick.source : undefined
}

/**
 * After Generate All settles the day's article: the pick to keep.
 * - the day is already fixed (something posted): keep the stored pick only if it is for that article
 * - the server chose the article: 'auto'
 * - Roi forced a selection: where it came from (recommendation / search), else 'unknown'
 * - a "keep existing" run on the stored drafts' article: the stored pick if it is for that article
 */
export function pickAfterGenerate(opts: {
  sharedId: string | null
  dayFixed: boolean
  serverPicked: boolean
  selected: { id: string; source?: 'recommendation' | 'search' } | null
  previous: Pick | null
}): Pick | null {
  const { sharedId, dayFixed, serverPicked, selected, previous } = opts
  if (!sharedId) return previous
  if (dayFixed) return previous?.articleId === sharedId ? previous : null
  if (serverPicked) return { articleId: sharedId, source: 'auto' }
  if (selected && selected.id === sharedId) return { articleId: sharedId, source: selected.source ?? 'unknown' }
  return previous?.articleId === sharedId ? previous : null
}

/** The day's pick source from its trial rows: the earliest post's (approval created_at, then id) known value. */
export function daySource(rows: { created_at: string; approval_id: string; pick_source: string | null }[]): { source: PickSource | null; disagree: boolean } {
  const known = rows.filter(r => r.pick_source && r.pick_source !== 'unknown')
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.approval_id.localeCompare(b.approval_id))
  const any = rows.filter(r => r.pick_source)
  const source = known.length ? known[0].pick_source as PickSource : any.length ? 'unknown' : null
  return { source, disagree: new Set(known.map(r => r.pick_source)).size > 1 }
}

/** The one call logPickSource makes — the supabase-js admin client satisfies it. */
export type PickLogClient = {
  from(table: 'growth_trial_posts'): {
    update(v: { pick_source: PickSource }): {
      eq(col: 'approval_id', v: string): {
        is(col: 'pick_source', v: null): { abortSignal(s: AbortSignal): PromiseLike<{ error: { message: string } | null }> }
      }
    }
  }
}

export const PICK_LOG_TIMEOUT_MS = 5_000

/**
 * After record_trial_post committed: fills pick_source on that post's trial row if still empty (a retry that gets
 * already_recorded can fill it too). Never throws and never waits longer than the timeout — the post is recorded
 * whatever happens here. Returns whether the write went through; `onFail` reports a failure (Sentry in the route).
 */
export async function logPickSource(client: PickLogClient, approvalId: unknown, source: PickSource,
  onFail: () => void = () => {}, timeoutMs = PICK_LOG_TIMEOUT_MS): Promise<boolean> {
  if (typeof approvalId !== 'string' || !approvalId) { onFail(); return false }
  try {
    const signal = AbortSignal.timeout(timeoutMs)
    const write = Promise.resolve(client.from('growth_trial_posts').update({ pick_source: source })
      .eq('approval_id', approvalId).is('pick_source', null).abortSignal(signal))
    // a client that ignores the signal still can't hold the response past the timeout
    let timer: ReturnType<typeof setTimeout> | undefined
    const timedOut = new Promise<{ error: { message: string } }>(res => { timer = setTimeout(() => res({ error: { message: 'timed out' } }), timeoutMs + 50) })
    const { error } = await Promise.race([write, timedOut]).finally(() => clearTimeout(timer))
    if (!error) return true
    console.error('[trial/mark] pick_source not logged:', error.message)
  } catch (e) {
    console.error('[trial/mark] pick_source not logged:', e instanceof Error ? e.message : String(e))
  }
  onFail()
  return false
}
