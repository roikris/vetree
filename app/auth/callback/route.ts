export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
