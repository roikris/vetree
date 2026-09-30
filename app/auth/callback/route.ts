export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SIGNUP_NONCE_COOKIE, SIGNUP_NONCE_RE } from '@/lib/constants/consent'

// Server-side OAuth code exchange — the only place that should ever redirect a
// user straight from Google back into the app. Before this route existed,
// signInWithOAuth's redirectTo pointed directly at the destination page, whose
// first (and, for a hard-redirect guard like app/profile/page.tsx's
// redirect('/login'), ONLY) server render ran before the client-side code
// exchange even started — a guaranteed loss, not a race, for any OAuth
// login/signup landing on a server-guarded page. Exchanging here means
// cookies are already set (via the Set-Cookie header on this redirect
// response) before the destination is ever requested.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') || '/'
  const next = rawNext.startsWith('/') ? rawNext : '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const res = NextResponse.redirect(`${origin}${next}`)
      // A Google SIGNUP carries the nonce of the digest choice it stored before redirecting. Hand
      // it back only now that this flow's sign-in succeeded, bound to the account it signed in
      // ("<nonce>.<userId>"); ConsentGate records the choice only for a matching nonce AND user
      // (lib/constants/consent). Any other sign-in deletes a leftover cookie. Readable, short-lived.
      const nonce = searchParams.get('signup_nonce')
      const userId = data.user?.id
      if (nonce && SIGNUP_NONCE_RE.test(nonce) && userId) {
        res.cookies.set(SIGNUP_NONCE_COOKIE, `${nonce}.${userId}`, { maxAge: 600, path: '/', sameSite: 'lax', secure: true, httpOnly: false })
      } else {
        res.cookies.set(SIGNUP_NONCE_COOKIE, '', { maxAge: 0, path: '/' })
      }
      return res
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
