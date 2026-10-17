import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ratelimitLoose, getClientIP, rateLimitIP } from '@/lib/ratelimit'
import { hashIP } from '@/lib/ipHash'
import { detectBotName } from '@/lib/bot-detection'
import { trafficClassForIP } from '@/lib/analytics/datacenter'
import { analyticsRecordingEnabled, isQATraffic, isSynthesisEvent } from '@/lib/analytics/recording'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const str = (v: unknown, max = 2048): string | null =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null

// Two payloads (analytics-001, migration 084):
//   load      { view_id, path, referrer, session_id, utm_* }  → one page_views row (view_id = its id)
//   duration  { view_id, session_id, duration_seconds }       → raises that row's duration, never a new row
// Tabs still running the old tracker send loads without view_id (the server makes one) and durations as
// { path, session_id, duration_seconds } (applied to that session + path's latest load).
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 60 requests per minute per IP (hashed key)
    const { success } = await ratelimitLoose.limit(rateLimitIP(request))
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const { path: rawPath, event, referrer, session_id: rawSession, duration_seconds, view_id: rawViewId, utm_source, utm_medium, utm_campaign, utm_id } = body ?? {}
    const viewId = typeof rawViewId === 'string' && UUID_RE.test(rawViewId) ? rawViewId.toLowerCase() : null
    const sessionId = str(rawSession, 100)
    const isDuration = duration_seconds !== undefined && duration_seconds !== null

    // Only the production deployment records (previews and local dev share the production DB).
    // Skip QA bot traffic — VetreeQABot UA or x-qa-bot header (deliberate internal
    // smoke-test traffic, not real crawler noise — excluded entirely, not tagged)
    const userAgent = request.headers.get('user-agent') || ''
    if (!analyticsRecordingEnabled() || isQATraffic(userAgent, request.headers)) {
      return NextResponse.json({ success: true, tracked: false })
    }

    // Writes use the service role: the public key cannot insert into page_views / analytics_events
    // (since migration 078, infra-002), so rows only arrive through this route's filters (QA, admin, bot tagging).
    const db = createAdminClient()

    if (isDuration) {
      const seconds = Number(duration_seconds)
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86400) {
        return NextResponse.json({ error: 'duration_seconds must be an integer 1..86400' }, { status: 400 })
      }
      // No auth lookup: an admin's views were never recorded, so their durations find no row (a pending row that
      // expires after a day). Saves an auth round trip on every leave ping.
      if (viewId) {
        const { data, error } = await db.rpc('record_page_view_duration', { p_id: viewId, p_session_id: sessionId, p_seconds: seconds })
        if (error) {
          console.error('[analytics/track] duration update failed:', error.message)
          return NextResponse.json({ success: false }, { status: 200 })
        }
        return NextResponse.json({ success: true, result: data })
      }
      const { data, error } = await db.rpc('record_legacy_page_view_duration', { p_session_id: sessionId, p_path: str(rawPath), p_seconds: seconds })
      if (error) {
        console.error('[analytics/track] legacy duration update failed:', error.message)
        return NextResponse.json({ success: false }, { status: 200 })
      }
      return NextResponse.json({ success: true, result: data ? 'updated' : 'dropped' })
    }

    const path = str(rawPath) || (event === 'synthesis_engaged' ? '/synthesis/engaged' : null)
    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    // Known crawlers (link-preview bots, search/ads verifiers, AI scrapers) are still
    // recorded — tagged via bot_name so burst/resource monitoring stays possible —
    // but analytics reads filter bot_name IS NULL to keep human metrics clean.
    const botName = detectBotName(userAgent)

    // Get user if logged in
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Check if admin - don't track admin traffic
    if (user) {
      const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (role?.role === 'admin') {
        return NextResponse.json({ success: true, tracked: false })
      }
    }

    // Synthesis experiment events are NOT page views (CLAUDE.md rule 12). Browser tabs still running
    // an older build send {event:'synthesis_engaged'} or a '/synthesis/*' path here: record them in
    // analytics_events (as /api/analytics/event does) and never in page_views.
    if (path.startsWith('/synthesis/')) {
      const eventName = `synthesis_${path.slice('/synthesis/'.length)}`
      if (!isSynthesisEvent(eventName)) return NextResponse.json({ success: true, tracked: false })
      const { error: eventError } = await db.from('analytics_events').insert({
        event_name: eventName,
        user_id: user?.id || null,
        bot_name: botName,
        detail: { via: 'legacy_track_payload' },
      })
      if (eventError) {
        console.error('[analytics/track] legacy synthesis event insert failed:', eventError.message)
        return NextResponse.json({ success: false }, { status: 200 })
      }
      return NextResponse.json({ success: true })
    }

    // The raw IP is used only here, in memory: hashed for ip_hash, looked up for traffic_class. Never stored.
    const ip = getClientIP(request)
    const ipHash = hashIP(ip)
    // Confirmed crawlers keep bot_name only; the hosting-network estimate applies to everything else.
    const trafficClass = botName ? null : trafficClassForIP(ip)

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
    const city = request.headers.get('x-vercel-ip-city') || null

    const { data: inserted, error } = await db.rpc('record_page_view_load', {
      p_id: viewId ?? randomUUID(),
      p_path: path,
      p_referrer: str(referrer),
      p_user_agent: userAgent || null,
      p_ip_hash: ipHash,
      p_user_id: user?.id || null,
      p_country: country,
      p_city: city,
      p_device_type: deviceType,
      p_session_id: sessionId,
      p_utm_source: str(utm_source, 200),
      p_utm_medium: str(utm_medium, 200),
      p_utm_campaign: str(utm_campaign, 200),
      p_utm_id: str(utm_id, 200),
      p_bot_name: botName,
      p_traffic_class: trafficClass,
    })

    if (error) {
      console.error('[analytics] Error inserting page view:', error.message)
      // Don't fail the request if analytics fails
      return NextResponse.json({ success: false }, { status: 200 })
    }

    return NextResponse.json(inserted ? { success: true } : { success: true, duplicate: true })

  } catch (error) {
    console.error('[analytics] Error tracking page view:', error instanceof Error ? error.message : 'unknown')
    // Don't fail the request if analytics fails
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
