import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createClient } from '@/lib/supabase/server'

// Middleware handles auth token refresh and email verification
export async function middleware(request: NextRequest) {
  // First, update the session
  const response = await updateSession(request)

  // Check email verification for authenticated users
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Allow verification page and auth callbacks
    if (
      request.nextUrl.pathname === '/verify-email' ||
      request.nextUrl.pathname.startsWith('/auth/') ||
      request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/signup'
    ) {
      return response
    }

    // Check if email is confirmed
    const isEmailConfirmed = user.email_confirmed_at !== null

    // Check if user signed in with Google OAuth (they are pre-verified)
    const isOAuthUser = user.app_metadata?.provider === 'google'

    // If not confirmed and not OAuth, redirect to verification page
    if (!isEmailConfirmed && !isOAuthUser) {
      const verifyUrl = new URL('/verify-email', request.url)
      return NextResponse.redirect(verifyUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - api (API routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
