export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Re-queue articles that are marked done but missing clinical_bottom_line
    const { data, error } = await supabase
      .from('articles')
      .update({
        needs_enrichment: true,
        enrichment_attempts: 0,
        force_retry: false,
        last_enrichment_error: 'Re-queued: incomplete enrichment (missing clinical_bottom_line)'
      })
      .eq('needs_enrichment', false)
      .is('clinical_bottom_line', null)
      .select('id')

    if (error) {
      return NextResponse.json({
        error: error.message
      }, { status: 500 })
    }

    const count = data?.length || 0

    return NextResponse.json({
      success: true,
      count,
      message: `Re-queued ${count} articles with incomplete enrichment`
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error)
    }, { status: 500 })
  }
}
