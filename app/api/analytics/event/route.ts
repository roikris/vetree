import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getClientIP } from '@/lib/ratelimit'
import { hashIP } from '@/lib/ipHash'
import { trafficClassForIP } from '@/lib/analytics/datacenter'
import { detectBotName } from '@/lib/bot-detection'
import { analyticsRecordingEnabled, isQATraffic } from '@/lib/analytics/recording'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MOBILE_UA_REGEX = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone/i
const IN_APP_UA_REGEX = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Twitter|LinkedInApp|WhatsApp|GSA\//i

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_name, article_id, detail } = body

    if (!event_name || typeof event_name !== 'string') {
      return NextResponse.json({ success: false })
    }

    // Only the production deployment records (previews and local dev share the production DB);
    // QA smoke traffic never. success:true, tracked:false = deliberately not recorded.
    const userAgent = request.headers.get('user-agent') || ''
    if (!analyticsRecordingEnabled() || isQATraffic(userAgent, request.headers)) {
      return NextResponse.json({ success: true, tracked: false })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Skip admin events — same pattern as /api/analytics/track
    if (user) {
      const { data: role } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id).single()
      if (role?.role === 'admin') {
        return NextResponse.json({ success: true, tracked: false })
      }
    }

    // Coarse device + in-app-browser detection from UA (same regex family as /api/analytics/track)
    const device = {
      type: MOBILE_UA_REGEX.test(userAgent) ? 'mobile' : 'desktop',
      in_app_browser: IN_APP_UA_REGEX.test(userAgent),
    }

    // Hash IP for a stable anonymous actor key — same scheme as page_views.ip_hash, never raw IP
    const ip = getClientIP(request)
    const ipHash = hashIP(ip)
    const botName = detectBotName(userAgent)

    const mergedDetail = {
      ...(detail && typeof detail === 'object' ? detail : {}),
      device,
      ip_hash: ipHash,
    }

    // Service role: the public key cannot insert into analytics_events (since migration
    // 078, infra-002), so rows only arrive through this route's filters (QA, admin, bot tagging)
    const { error } = await createAdminClient().from('analytics_events').insert({
      event_name,
      article_id: article_id || null,
      user_id: user?.id || null,
      // Crawlers are recorded but tagged; every reader filters bot_name IS NULL
      bot_name: botName,
      // Hosting-network estimate (analytics-001) — not a bot verdict; readers show it apart, never drop it
      traffic_class: botName ? null : trafficClassForIP(ip),
      detail: mergedDetail,
    })
    if (error) {
      console.error('[analytics/event] insert failed:', event_name, error.message)
      return NextResponse.json({ success: false })
    }

    return NextResponse.json({ success: true })
  } catch {
    // Never fail the caller — fire-and-forget
    return NextResponse.json({ success: false })
  }
}
