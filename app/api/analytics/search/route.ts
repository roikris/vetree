import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { query, results_count } = body

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Don't log single character searches
    if (query.trim().length < 2) {
      return NextResponse.json({ success: true })
    }

    // Get user if logged in
    const { data: { user } } = await supabase.auth.getUser()

    // Get IP from headers (privacy-conscious: we'll hash it)
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'

    // Hash IP for privacy (never store raw IP)
    const ipHash = createHash('sha256').update(ip + process.env.IP_HASH_SALT || 'vetree-salt').digest('hex')

    // Insert search log
    const { error } = await supabase
      .from('search_logs')
      .insert({
        query: query.trim(),
        results_count: results_count || 0,
        user_id: user?.id || null,
        ip_hash: ipHash
      })

    if (error) {
      console.error('[analytics] Error inserting search log:', error)
      // Don't fail the request if analytics fails
      return NextResponse.json({ success: false }, { status: 200 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[analytics] Error tracking search:', error)
    // Don't fail the request if analytics fails
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
