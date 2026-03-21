export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Quick search for admin article picker in campaign calendar.
 * Returns articles matching query with basic metadata.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '5', 10)

    if (!q || q.length < 3) {
      return NextResponse.json({ articles: [] })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Search articles by title or clinical_bottom_line
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, source_journal, publication_date, labels')
      .eq('needs_enrichment', false)
      .not('clinical_bottom_line', 'is', null)
      .or('quarantined.is.null,quarantined.eq.false')
      .or(`title.ilike.%${q}%,clinical_bottom_line.ilike.%${q}%`)
      .order('publication_date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[search-quick] Search error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ articles: data || [] })

  } catch (error) {
    console.error('[search-quick] Error:', error)
    return NextResponse.json(
      { error: 'Failed to search articles' },
      { status: 500 }
    )
  }
}
