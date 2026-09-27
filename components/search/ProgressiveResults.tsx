'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArticleList } from '@/components/articles/ArticleList'
import { SproutLoader } from '@/components/search/SproutLoader'
import { Article } from '@/lib/supabase'
import { ParsedFilters, SortOption } from '@/types/search'
import { buildSearchParams } from '@/lib/utils/searchParams'
import { defaultQuickFilterFor } from '@/lib/utils/species'
import type { Disclosure, SearchArticle } from '@/lib/search/progressive'

const REVEAL_STEP = 50

type Props = {
  filters: ParsedFilters
  initialArticles: SearchArticle[]
  initialCursor: string | null
  initialDone: boolean
  disclosure: Disclosure
  newThisWeek?: number
}

type FetchStatus = 'idle' | 'fetching' | 'error' | 'fetchDone'

// Searches logged in this page session. The component remounts on every new search key
// (sort / filter changes included), so dedup by query text lives outside it.
let lastLoggedQuery = ''

/** Called when the search is cleared (SearchControls), so searching the same text again later logs */
export function resetSearchLogDedup() {
  lastLoggedQuery = ''
}

/**
 * Search results, loaded progressively (plan reviewed with Codex; migration 060).
 * Remounted by the parent's key for every new search, so all state starts fresh per search.
 *
 * Two counters: `items` (rows fetched) and `revealed` (rows shown). Scrolling reveals
 * REVEAL_STEP more buffered rows in any fetch state; only when everything fetched is shown
 * does it fetch the next database batch. "Search finished!" requires both to be complete.
 */
export function ProgressiveResults({ filters, initialArticles, initialCursor, initialDone, disclosure, newThisWeek }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<SearchArticle[]>(initialArticles)
  const [revealed, setRevealed] = useState(Math.min(REVEAL_STEP, initialArticles.length))
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>(initialDone ? 'fetchDone' : 'idle')
  const inFlight = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Abandon any in-flight batch when this search is replaced (component unmounts)
  useEffect(() => () => abortRef.current?.abort(), [])

  // ── Search logging: mounted only for a search that returned successfully ──────────────
  useEffect(() => {
    const query = filters.search.trim()
    const unfiltered =
      filters.quickFilter === defaultQuickFilterFor(query) &&
      filters.labels.length === 0 && filters.evidence.length === 0 && filters.journals.length === 0
    if (query.length < 2 || !unfiltered || query === lastLoggedQuery) return
    lastLoggedQuery = query
    const lowerBound =
      disclosure.kind === 'fallback' ? disclosure.capped
      : disclosure.kind === 'best-of-recent' ? true
      : !initialDone
    fetch('/api/analytics/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, results_count: initialArticles.length, results_count_is_lower_bound: lowerBound }),
    }).catch(() => { /* best-effort */ })
    // Logged once per mount (a search); deliberately not re-run on later batches
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // `retry` bypasses the idle check (status is 'error'); in-flight dedup still applies
  const fetchMore = useCallback(async (retry = false) => {
    if ((!retry && fetchStatus !== 'idle') || !cursor || inFlight.current === cursor) return
    inFlight.current = cursor
    setFetchStatus('fetching')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const params = new URLSearchParams(buildSearchParams({ ...filters, page: 1 }))
      params.set('cursor', cursor)
      const res = await fetch(`/api/search/batch?${params.toString()}`, { signal: controller.signal })
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json()
      const incoming: SearchArticle[] = json.articles ?? []
      setItems(prev => {
        const seen = new Set(prev.map(a => a.id))
        return [...prev, ...incoming.filter(a => !seen.has(a.id))]
      })
      // Reveal the next step right away — otherwise the sentinel stays put and automatic
      // loading would stall until the reader scrolls away and back. Rendering slices and the
      // finished check compares with >=, so running past items.length is harmless.
      setRevealed(r => r + REVEAL_STEP)
      setCursor(json.nextCursor ?? null)
      setFetchStatus(json.done || !json.nextCursor ? 'fetchDone' : 'idle')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setFetchStatus('error')
    } finally {
      inFlight.current = null
    }
  }, [cursor, fetchStatus, filters])

  const advance = useCallback(() => {
    if (Math.min(revealed, items.length) < items.length) {
      setRevealed(r => Math.min(r + REVEAL_STEP, items.length))
    } else if (fetchStatus === 'idle' && cursor) {
      void fetchMore()
    }
  }, [revealed, items.length, fetchStatus, cursor, fetchMore])

  // Reveal / fetch as the end of the list approaches. One observer for the component's life,
  // reading the latest `advance` through a ref, with a latch: it acts only when the sentinel
  // ENTERS the zone (armed again once it leaves), so it never fires repeatedly on its own.
  const advanceRef = useRef(advance)
  useEffect(() => { advanceRef.current = advance }, [advance])
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    let armed = true
    const io = new IntersectionObserver(entries => {
      const inView = entries.some(e => e.isIntersecting)
      if (inView && armed) { armed = false; advanceRef.current() }
      else if (!inView) armed = true
    }, { rootMargin: '0px 0px 600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const shown = Math.min(revealed, items.length)
  const finished = fetchStatus === 'fetchDone' && shown >= items.length
  const moreAvailable = shown < items.length || (fetchStatus === 'idle' && !!cursor)
  const q = filters.search.trim()

  const setSort = (sort: SortOption) => {
    router.push(`/?${buildSearchParams({ ...filters, sort, page: 1 })}`)
  }

  const countLine = (() => {
    const quoted = <>for &ldquo;{q}&rdquo;</>
    if (disclosure.kind === 'fallback') {
      return <>No exact matches {quoted} — showing <span style={{ color: 'var(--al-accent)', fontWeight: 600 }}>closest matches{disclosure.capped ? ' (up to 200)' : ''}</span></>
    }
    if (disclosure.kind === 'best-of-recent') {
      return <>
        <span style={{ color: 'var(--al-accent)', fontWeight: 600 }}>Best matches</span> among the {disclosure.poolSize} most recent results {quoted}{' · '}
        <button type="button" onClick={() => setSort('newest')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--al-accent)', textDecoration: 'underline', font: 'inherit' }}>
          Browse all in Newest
        </button>
      </>
    }
    const n = items.length.toLocaleString()
    return <><span style={{ color: 'var(--al-accent)', fontWeight: 600 }}>{fetchStatus === 'fetchDone' ? n : `${n}+`} results</span> {quoted}</>
  })()

  const orderLabel = filters.sort === 'relevance' ? 'Best match' : filters.sort === 'oldest' ? 'Oldest first' : 'Newest first'

  const toggle = (
    <div role="group" aria-label="Order results" style={{ display: 'flex', gap: 6, margin: '4px 0 14px' }}>
      {([['relevance', 'Best match'], ['newest', 'Newest']] as [SortOption, string][]).map(([value, label]) => {
        const active = filters.sort === value
        return (
          <button
            key={value}
            type="button"
            data-testid={`sort-${value}`}
            aria-pressed={active}
            onClick={() => !active && setSort(value)}
            style={{
              padding: '6px 13px', borderRadius: 999, cursor: active ? 'default' : 'pointer',
              font: '600 12.5px/1 var(--font-instrument, sans-serif)',
              background: active ? 'var(--al-accent)' : 'transparent',
              color: active ? 'var(--al-on-accent)' : 'var(--al-mut3)',
              border: active ? '1px solid var(--al-accent)' : '1px solid rgba(var(--al-line, 232,224,204), .18)',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <ArticleList
        articles={items.slice(0, shown) as unknown as Article[]}
        searchQuery={q}
        view={filters.view}
        newThisWeek={newThisWeek}
        countLine={items.length > 0 ? countLine : undefined}
        orderLabel={orderLabel}
        headerExtra={items.length > 0 ? toggle : undefined}
      />

      {items.length > 0 && filters.view !== 'grove' && (
        <div style={{ maxWidth: filters.view === 'list' ? 844 : 704, margin: '-70px auto 60px', padding: '0 32px', textAlign: 'center' }}>
          <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
          <div role="status" aria-live="polite" data-testid="search-progress">
            {fetchStatus === 'fetching' && <SproutLoader state="growing" label="Loading more search results…" />}
            {finished && <SproutLoader state="done" label="Search finished!" />}
            {fetchStatus === 'error' && (
              <p style={{ fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 13.5, color: 'var(--al-mut3)', margin: '12px 0' }}>
                Couldn&apos;t load more results.
              </p>
            )}
          </div>
          {fetchStatus !== 'fetching' && fetchStatus !== 'error' && moreAvailable && (
            <SproutLoader state="resting" label="More results below" showLabel={false} />
          )}
          {/* One control, kept mounted while loading so keyboard focus is never lost:
              Load more → (disabled) Loading… → Load more, or Retry after an error */}
          {(moreAvailable || fetchStatus === 'fetching' || fetchStatus === 'error') && (
            <button
              type="button"
              data-testid={fetchStatus === 'error' ? 'search-retry' : 'search-load-more'}
              aria-disabled={fetchStatus === 'fetching'}
              onClick={() => {
                if (fetchStatus === 'fetching') return
                if (fetchStatus === 'error') void fetchMore(true)
                else advance()
              }}
              style={{ ...loadMoreStyle, opacity: fetchStatus === 'fetching' ? 0.6 : 1 }}
            >
              {fetchStatus === 'error' ? 'Retry' : fetchStatus === 'fetching' ? 'Loading…' : 'Load more results'}
            </button>
          )}
        </div>
      )}
    </>
  )
}

const loadMoreStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
  font: '600 13px/1 var(--font-instrument, sans-serif)',
  background: 'var(--al-card)', color: 'var(--al-mut2)',
  border: '1px solid rgba(var(--al-line, 232,224,204), .18)',
}
