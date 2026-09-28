'use client'

/**
 * A guest pressing any Save button enters the existing save-intent flow
 * (components/articles/SaveIntentHandler): sign-in prompt → return to the article with
 * ?intent=save → the save completes. Before 2026-09-28 guest Save buttons did nothing, were
 * hidden, or linked to signup without completing the save.
 *
 * - On the article page, the handler is already mounted: open its prompt in place (event).
 * - Anywhere else (feed rows, cards): open the article with ?intent=save.
 */
export const SAVE_INTENT_EVENT = 'vetree:save-intent'

export function requestGuestSave(articleId: string, opts: { onArticlePage: boolean; push?: (url: string) => void }) {
  if (opts.onArticlePage) {
    window.dispatchEvent(new CustomEvent(SAVE_INTENT_EVENT, { detail: { articleId } }))
    return
  }
  const url = `/article/${encodeURIComponent(articleId)}?intent=save`
  if (opts.push) opts.push(url)
  else window.location.assign(url)
}
