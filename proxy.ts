import { type NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { updateSession } from '@/lib/supabase/middleware'

// Proxy (Next 16 name for middleware; Node.js runtime) handles auth token refresh and email verification
export async function proxy(request: NextRequest) {
  try {
    return await handle(request)
  } catch (err) {
    // Next 16.3.8 passes proxy errors only to the Edge copy of instrumentation.ts onRequestError, which never
    // loads on Node — report them here. Method + path only: no query string, no headers.
    Sentry.captureRequestError(
      err,
      { path: request.nextUrl.pathname, method: request.method, headers: {} },
      { routerKind: 'Pages Router', routePath: '/proxy', routeType: 'proxy' }
    )
    throw err
  }
}

async function handle(request: NextRequest) {
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
     * Match all request paths except for the ones that can never depend on
     * session state:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt, sitemap.xml, sitemaps/ (sitemap shards), manifest.json
     *   (static/generated SEO + PWA files)
     * - sw.js (the service worker script — a redirect, e.g. to /verify-email, makes the browser
     *   reject the update and keep the old worker)
     * - opengraph-image (per-article OG image routes — fetched by link-preview
     *   crawlers, never by an authenticated browser session)
     * - api (API routes — each does its own auth, see app/api/CLAUDE.md)
     * - raster image files
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|sitemaps/|manifest\\.json|sw\\.js|.*opengraph-image|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
