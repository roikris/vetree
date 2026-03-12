import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { ratelimitLoose, getClientIP } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 60 requests per minute per IP
    const rateLimitIP = getClientIP(request)
    const { success } = await ratelimitLoose.limit(rateLimitIP)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const supabase = await createClient()
    const body = await request.json()
    const { path, referrer, session_id, duration_seconds, utm_source, utm_medium, utm_campaign } = body

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

    // Get user agent and parse device type
    const userAgent = request.headers.get('user-agent') || ''

    // Check Vercel's built-in headers first (most reliable)
    const secChUaMobile = request.headers.get('sec-ch-ua-mobile')

    let deviceType = 'desktop' // default

    if (secChUaMobile === '?1') {
      deviceType = 'mobile'
    } else if (secChUaMobile === '?0') {
      deviceType = 'desktop'
    } else {
      // Fallback: parse user agent string
      const mobileRegex = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone/i
      const tabletRegex = /iPad|Android(?!.*Mobile)|Tablet/i

      if (tabletRegex.test(userAgent)) {
        deviceType = 'tablet'
      } else if (mobileRegex.test(userAgent)) {
        deviceType = 'mobile'
      } else {
        deviceType = 'desktop'
      }
    }

    // Get country and city from Vercel headers - check all possible headers
    const country =
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry') ||
      request.headers.get('x-country-code') ||
      'Unknown'
    const city = request.headers.get('x-vercel-ip-city') || undefined

    // Temporary logging for debugging
    console.log('[analytics/track] UA:', userAgent.slice(0, 100))
    console.log('[analytics/track] device:', deviceType, 'country:', country)
    console.log('[analytics/track] sec-ch-ua-mobile:', secChUaMobile)

    // Insert page view
    const { error } = await supabase
      .from('page_views')
      .insert({
        path,
        referrer: referrer || undefined,
        user_agent: userAgent || undefined,
        ip_hash: ipHash,
        user_id: user?.id || null,
        country,
        city,
        device_type: deviceType,
        session_id: session_id || undefined,
        duration_seconds: duration_seconds || undefined,
        utm_source: utm_source || undefined,
        utm_medium: utm_medium || undefined,
        utm_campaign: utm_campaign || undefined
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
