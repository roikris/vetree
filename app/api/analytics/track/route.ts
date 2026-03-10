import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { path, referrer, session_id, duration_seconds } = body

    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    // Get user if logged in
    const { data: { user } } = await supabase.auth.getUser()

    // Check if admin - don't track admin traffic
    if (user) {
      const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (role?.role === 'admin') {
        return NextResponse.json({ success: true, tracked: false })
      }
    }

    // Get IP from headers (privacy-conscious: we'll hash it)
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'

    // Hash IP for privacy (never store raw IP)
    const ipHash = createHash('sha256').update(ip + process.env.IP_HASH_SALT || 'vetree-salt').digest('hex')

    // Get user agent
    const userAgent = request.headers.get('user-agent') || undefined

    // Get country from Vercel headers
    const country = request.headers.get('x-vercel-ip-country') || undefined

    // Insert page view
    const { error } = await supabase
      .from('page_views')
      .insert({
        path,
        referrer: referrer || undefined,
        user_agent: userAgent,
        ip_hash: ipHash,
        user_id: user?.id || null,
        country,
        session_id: session_id || undefined,
        duration_seconds: duration_seconds || undefined
      })

    if (error) {
      console.error('[analytics] Error inserting page view:', error)
      // Don't fail the request if analytics fails
      return NextResponse.json({ success: false }, { status: 200 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[analytics] Error tracking page view:', error)
    // Don't fail the request if analytics fails
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
