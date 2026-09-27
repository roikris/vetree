import { NextRequest, NextResponse } from 'next/server'
import { parseSearchParams } from '@/lib/utils/searchParams'
import { runSearchBatch, decodeCursor } from '@/lib/search/progressive'
import { ratelimitLoose, getClientIP } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Next batch of a progressive search (the first batch is server-rendered by
// components/search/SearchResults). Same parser and search path as the page.
// Rate limiting here is ROUTE-ONLY protection: the underlying RPC is callable with the anon
// key directly, and server-rendered first batches don't pass through this route.
export async function GET(request: NextRequest) {
  try {
    const { success } = await ratelimitLoose.limit(`search:${getClientIP(request)}`)
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const sp = request.nextUrl.searchParams
    // Repeated params (labels, evidence, journals) must stay arrays
    const raw: Record<string, string | string[]> = {}
    for (const key of new Set(sp.keys())) {
      const all = sp.getAll(key)
      raw[key] = all.length > 1 ? all : all[0]
    }
    const filters = parseSearchParams(raw)
    if (!filters.search.trim()) {
      return NextResponse.json({ error: 'search is required' }, { status: 400 })
    }

    const cursorRaw = sp.get('cursor')
    const cursor = cursorRaw ? decodeCursor(cursorRaw, filters.sort) : null
    if (cursorRaw && !cursor) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
    }

    const result = await runSearchBatch(filters, cursor)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({
      articles: result.articles,
      nextCursor: result.nextCursor,
      done: result.done,
      disclosure: result.disclosure,
    })
  } catch (error) {
    console.error('[search/batch] error:', error)
    return NextResponse.json({ error: 'Search is temporarily unavailable. Please try again.' }, { status: 500 })
  }
}
