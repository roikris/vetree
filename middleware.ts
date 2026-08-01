import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Middleware handles auth token refresh and email verification
export async function middleware(request: NextRequest) {
  // Single session read per request — this used to call getUser() a second
  // time here via a separate server client reading the same request cookies
  // updateSession() had already read, at the cost of an extra Supabase
  // round-trip on every request. updateSession() now returns the user it
  // already fetched.
  const { response, user } = await updateSession(request)

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
