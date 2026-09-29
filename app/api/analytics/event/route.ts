import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
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
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'
    const ipHash = createHash('sha256').update(ip + (process.env.IP_HASH_SALT || 'vetree-salt')).digest('hex')

    const mergedDetail = {
      ...(detail && typeof detail === 'object' ? detail : {}),
      device,
      ip_hash: ipHash,
    }

    const { error } = await supabase.from('analytics_events').insert({
      event_name,
      article_id: article_id || null,
      user_id: user?.id || null,
      // Crawlers are recorded but tagged; every reader filters bot_name IS NULL
      bot_name: detectBotName(userAgent),
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
