import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/server'
import { rateLimitIP, ratelimitLoose } from '@/lib/ratelimit'
import { resolveIlPath, type IlClient } from '@/lib/growth/ilTarget'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// vetree.app/il — the address at the end of every Facebook IL post and the Page's action button (social-001 / 002).
// Facebook limits some business / creator Pages to two external links a month, so the daily Facebook IL post carries
// no web link; readers type this address or tap the button and land on today's article (lib/growth/ilTarget.ts: the
// newest article marked as posted on any platform), tagged so analytics still attribute the visit to Facebook IL.
// Rate-limited, no post yet, a hidden article or any error (the limiter included) → the home page, never an error page.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://vetree.app'
const UTM = 'utm_source=facebook&utm_medium=social&utm_campaign=il&utm_content=page-button'

export async function GET(request: NextRequest) {
  const path = await resolveIlPath({
    limit: () => ratelimitLoose.limit(`il:${rateLimitIP(request)}`),
    // cast: the full Supabase client type is too deep for TypeScript to check against the small IlClient surface
    db: () => createAdminClient() as unknown as IlClient,
    report: e => Sentry.captureException(e),
  })
  const res = NextResponse.redirect(`${SITE}${path}?${UTM}`, 307)
  // the target changes every day: never let a browser, Facebook's in-app browser or a CDN keep an old one
  res.headers.set('Cache-Control', 'no-store')
  return res
}
