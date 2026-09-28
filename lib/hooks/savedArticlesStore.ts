// Saved-article store: no React, no auth — driven by lib/hooks/useSavedArticles and by
// scripts/test-saved-articles-store.ts (deterministic ordering tests).

/**
 * Saved-article state, shared by every component that shows a bookmark.
 *
 * WHY A SHARED STORE: every result row uses this hook and search shows 50+ rows. The old hook
 * called the server action getUserSavedArticleIds once per instance; server actions share
 * Next.js's sequential router queue with navigations, so a new search waited behind 50+ queued
 * actions for 10–15 s. Now: one plain GET /api/saved-articles per signed-in user, shared, and
 * never a server action (CLAUDE.md rule 12).
 *
 * CONSISTENCY RULES (Codex review, 2026-09-28):
 * - Nothing happens until auth has resolved: a freshly mounted hook briefly sees user=null while
 *   useAuth loads, which must not read as a sign-out and wipe the shared state.
 * - Every user change bumps `gen`; any response (GET or save) from an older generation is
 *   ignored, so one user's data can never land in another's.
 * - Only the latest GET for a generation may apply its result.
 * - Saves in flight are kept in `pending` (articleId → desired state + token). A GET result is
 *   applied with pending saves re-layered on top, so a lookup that started before a save cannot
 *   erase it. A save that SUCCEEDS while the first lookup is still running starts a fresh lookup,
 *   which supersedes the older one (whose pre-save data is then discarded). A failed save reverts
 *   ONLY its own article, and only if no newer save of that article has happened since.
 */
type Pending = { saved: boolean; token: number }
type Store = {
  gen: number
  userId: string | null
  ids: Set<string>
  loading: boolean
  /** the last lookup for this user failed; the next syncUser (e.g. a remount) retries it */
  failed: boolean
}

let store: Store = { gen: 0, userId: null, ids: new Set(), loading: true, failed: false }
let latestFetch = 0
let tokenSeq = 0
const pending = new Map<string, Pending>()
const listeners = new Set<() => void>()

function setStore(next: Partial<Store>) {
  store = { ...store, ...next }
  listeners.forEach(l => l())
}
export function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
export const getSnapshot = () => store

function withPending(ids: Set<string>): Set<string> {
  if (pending.size === 0) return ids
  const next = new Set(ids)
  for (const [id, p] of pending) {
    if (p.saved) next.add(id)
    else next.delete(id)
  }
  return next
}

async function fetchIds(gen: number) {
  const requestId = ++latestFetch
  try {
    const res = await fetch('/api/saved-articles', { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    const json = await res.json()
    if (store.gen !== gen || requestId !== latestFetch) return // stale
    setStore({ ids: withPending(new Set(json.articleIds ?? [])), loading: false, failed: false })
  } catch {
    // Bookmarks show as unsaved; saving still works. Clear loading only for the current request.
    if (store.gen === gen && requestId === latestFetch) setStore({ loading: false, failed: true })
  }
}

/** Called once auth has resolved. Starts a new generation only when the user actually changes. */
export function syncUser(userId: string | null) {
  if (store.userId === userId && store.gen > 0) {
    // Same user: nothing to do — unless the last lookup failed, then retry (keeps pending saves)
    if (userId && store.failed && !store.loading) {
      setStore({ loading: true, failed: false })
      void fetchIds(store.gen)
    }
    return
  }
  pending.clear()
  const gen = store.gen + 1
  setStore({ gen, userId, ids: new Set(), loading: !!userId, failed: false })
  if (userId) void fetchIds(gen)
}


export type SaveResult = { success?: true; error?: string }

/** Optimistic save/unsave for the current user; see the consistency rules above. */
export async function toggleSaveFor(userId: string, articleId: string): Promise<SaveResult> {
  const gen = store.gen
  if (store.userId !== userId) return { error: 'Not ready' }

  const wasSaved = store.ids.has(articleId)
  const token = ++tokenSeq
  pending.set(articleId, { saved: !wasSaved, token })
  setStore({ ids: withPending(store.ids) }) // optimistic, shared by every bookmark on the page

  // Plain fetch — bypasses Next.js's sequential router action queue
  let res: Response | null = null
  try {
    res = await fetch('/api/save-article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, action: wasSaved ? 'unsave' : 'save' }),
    })
  } catch {
    res = null
  }

  if (store.gen !== gen) return { error: 'Signed-in user changed' } // a different user's store now
  const mine = pending.get(articleId)?.token === token
  if (mine) pending.delete(articleId)

  if (!res || !res.ok) {
    // Revert only this article, and only if no newer save of it happened meanwhile
    if (mine) {
      const next = new Set(store.ids)
      if (wasSaved) next.add(articleId)
      else next.delete(articleId)
      setStore({ ids: withPending(next) })
    }
    const data = res ? await res.json().catch(() => ({})) : {}
    return { error: (data as { error?: string }).error || (res ? `HTTP ${res.status}` : 'Network error') }
  }
  // A lookup started before this save may still be running and would return pre-save data
  // once the pending overlay is gone: supersede it with a lookup that sees the save.
  if (store.loading) void fetchIds(gen)
  return { success: true }
}
