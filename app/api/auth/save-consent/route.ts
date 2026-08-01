import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getClientIP } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Rows where consentSource is one of these were a genuine, dedicated marketing ask —
// used by the digest route to tell "declined" apart from "never_asked". Omitting
// consentSource (or passing null) records a row without claiming marketing was the
// subject of it — e.g. the mandatory terms-acceptance gate, which still needs a
// marketing_opted_in value because the column is NOT NULL, but isn't asking.
const CONSENT_SOURCES = ['signup', 'in_app_prompt', 'settings'] as const
type ConsentSource = typeof CONSENT_SOURCES[number]

export async function POST(request: NextRequest) {
  try {
    const { userId, termsAccepted, marketingOptIn, consentSource } = await request.json()

    if (!userId || typeof termsAccepted !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (consentSource != null && !CONSENT_SOURCES.includes(consentSource)) {
      return NextResponse.json({ error: `consentSource must be one of ${CONSENT_SOURCES.join(', ')} or omitted` }, { status: 400 })
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
      consent_source: (consentSource ?? null) as ConsentSource | null,
      consented_at: new Date().toISOString(),
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
