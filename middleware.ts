import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createClient } from '@/lib/supabase/server'
import { addSecurityHeaders, csrfProtection, createCSRFErrorResponse, isCsrfExempt } from '@/lib/security'

// Middleware handles auth token refresh, email verification, security headers, and CSRF protection
export async function middleware(request: NextRequest) {
  // First, update the session
  let response = await updateSession(request)

  // Apply security headers to all responses
  response = addSecurityHeaders(response)

  // Handle CSRF protection for API routes (except exempt paths)
  if (request.nextUrl.pathname.startsWith('/api/') && !isCsrfExempt(request.nextUrl.pathname)) {
    const isValid = await csrfProtection.validateRequest(request)
    
    if (!isValid) {
      return addSecurityHeaders(createCSRFErrorResponse())
    }
  }

  // Set CSRF token cookie for all non-API requests
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    const existingToken = csrfProtection.getTokenFromCookie(request)
    if (!existingToken || !csrfProtection.verifyToken(existingToken)) {
      response = csrfProtection.setTokenCookie(response)
    }
  }

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
      const redirectResponse = NextResponse.redirect(verifyUrl)
      return addSecurityHeaders(redirectResponse)
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
     * Note: We now include API routes for CSRF protection
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
