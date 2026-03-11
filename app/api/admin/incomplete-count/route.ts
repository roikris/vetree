export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Count articles marked as done but missing clinical_bottom_line
    const { count, error } = await supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('needs_enrichment', false)
      .is('clinical_bottom_line', null)

    if (error) {
      return NextResponse.json({
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      count: count || 0
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error)
    }, { status: 500 })
  }
}
