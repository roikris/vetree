import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getClientIP } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { userId, termsAccepted, marketingOptIn } = await request.json()

    if (!userId || typeof termsAccepted !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify user exists
    const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(userId)
    if (userError || !authUser.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const ip = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || null

    const { error } = await supabase.from('user_consents').insert({
      user_id: userId,
      terms_accepted: termsAccepted,
      marketing_opted_in: marketingOptIn ?? false,
      consent_version: '1.0',
      ip_address: ip,
      user_agent: userAgent,
    })

    if (error) {
      console.error('[save-consent] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[save-consent] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
