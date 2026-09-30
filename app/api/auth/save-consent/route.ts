import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClientIP, ratelimitModerate } from '@/lib/ratelimit'
import { recordConsent, CONSENT_SOURCES, type ConsentSource } from '@/lib/consent/record'
import { isConsentLang } from '@/lib/consent/copy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Records the SIGNED-IN user's own consent (ConsentGate, DigestConsentPrompt).
//
// Session-only since 2026-09-28: this route used to accept any body userId and only check the
// account existed, so anyone could opt any user into the digest (Codex re-evaluation #5a).
// Email signup (no session until verified) keeps its choices in the signing-up browser;
// ConsentGate records them HERE once the verified owner is signed in, sending userId so a
// session that changed in the meantime is rejected (lib/constants/consent).
//
// consentSource: rows with a source were a dedicated marketing ask (digest route tells
// "declined" from "never_asked" with it); omitted/null = the mandatory terms gate, whose
// marketing value is a placeholder for the NOT NULL column.
export async function POST(request: NextRequest) {
  try {
    // Cookie-authenticated POST: refuse cross-site requests (CSRF)
    const origin = request.headers.get('origin')
    if (origin && new URL(origin).host !== request.headers.get('host')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.email_confirmed_at) {
      return NextResponse.json({ error: 'Email verification required' }, { status: 403 })
    }

    const { success } = await ratelimitModerate.limit(`consent:${user.id}`)
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const { userId, termsAccepted, marketingOptIn, consentSource, termsLanguage, marketingLanguage } = await request.json()
    // A body userId is tolerated for older clients but must be the caller
    if (userId != null && userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (typeof termsAccepted !== 'boolean') {
      return NextResponse.json({ error: 'termsAccepted must be a boolean' }, { status: 400 })
    }
    if (marketingOptIn != null && typeof marketingOptIn !== 'boolean') {
      return NextResponse.json({ error: 'marketingOptIn must be a boolean' }, { status: 400 })
    }
    // Language of the wording the person saw (migration 067); optional for older clients
    if ((termsLanguage != null && !isConsentLang(termsLanguage)) || (marketingLanguage != null && !isConsentLang(marketingLanguage))) {
      return NextResponse.json({ error: "termsLanguage / marketingLanguage must be 'en' or 'he'" }, { status: 400 })
    }
    if (consentSource != null && !CONSENT_SOURCES.includes(consentSource)) {
      return NextResponse.json({ error: `consentSource must be one of ${CONSENT_SOURCES.join(', ')} or omitted` }, { status: 400 })
    }

    const result = await recordConsent({
      userId: user.id,
      termsAccepted,
      marketingOptIn: marketingOptIn ?? false,
      consentSource: (consentSource ?? null) as ConsentSource | null,
      termsLanguage: termsLanguage ?? null,
      marketingLanguage: marketingLanguage ?? null,
      ip: getClientIP(request),
      userAgent: request.headers.get('user-agent') || null,
    })
    if (!result.ok) {
      console.error('[save-consent] insert error:', result.error)
      return NextResponse.json({ error: 'Could not record consent' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[save-consent] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
