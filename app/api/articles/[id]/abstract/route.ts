import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Source abstract for the article page's collapsed "Original abstract" section
// (components/articles/OriginalAbstract.tsx). Fetched only when a reader opens it, so the
// publisher's text is not in the server-rendered page. Anon key: RLS (migration 052) already
// limits reads to publicly eligible articles; the filters below state that explicitly.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase
      .from('articles')
      .select('abstract, abstract_fetched_at')
      .eq('id', id)
      .eq('needs_enrichment', false)
      .not('summary', 'is', null)
      .not('clinical_bottom_line', 'is', null)
      .or('quarantined.is.null,quarantined.eq.false')
      .maybeSingle()

    if (error) return NextResponse.json({ error: 'Could not load abstract' }, { status: 500 })
    // 500, not 404: 404 is reserved for unknown routes (CLAUDE.md rule 6)
    if (!data) return NextResponse.json({ error: 'Article not found' }, { status: 500 })

    return NextResponse.json(
      { abstract: data.abstract ?? null, fetchedAt: data.abstract_fetched_at ?? null },
      // Short CDN cache: repeat opens are cheap, but a takedown (publisher objection, article
      // hidden or deleted) must stop serving within the hour — CDN hits bypass RLS
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } }
    )
  } catch {
    return NextResponse.json({ error: 'Could not load abstract' }, { status: 500 })
  }
}
