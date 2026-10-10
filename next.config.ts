import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// NOTE: Using same-origin-allow-popups for COOP (not same-origin) because
// Google OAuth opens a popup window — strict same-origin would break the login flow.
// NOTE: Skipping Content-Security-Policy — requires careful whitelisting of
// Supabase, Vercel Analytics, Sentry, Google OAuth and would need extensive testing.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig: NextConfig = {
  // Enable Turbopack support (Next.js 16)
  turbopack: {},

  // The weekly security scan reads these source files at runtime (its fs calls are marked turbopackIgnore so the
  // build no longer ships the whole repo with it). A check that reads another file must add it here.
  // package.json / package-lock.json are for its npm audit step (Next also adds the dependencies' package.json
  // files when these are listed — ~1,000 small files; still lighter than shipping the whole repo).
  outputFileTracingIncludes: {
    '/api/admin/security/scan': [
      './app/**/*.{ts,tsx}',
      './next.config.ts',
      './proxy.ts',
      './security-acknowledged.json',
      './package.json',
      './package-lock.json',
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  // /auth/signin was renamed to /login (PR #12); Google still crawls the old URL (Search Console 404).
  async redirects() {
    return [
      { source: '/auth/signin', destination: '/login', permanent: true },
    ]
  },
};

// Sentry v9 build config (options renamed from v7)
export default withSentryConfig(nextConfig, {
  sourcemaps: { disable: true },  // was: hideSourceMaps: true
  disableLogger: true,
  telemetry: false,
  // The onRouterTransitionStart hook instruments client navigations (transaction names, trace context) for
  // tracing, which is off on purpose (tracesSampleRate 0, lib/sentry/options.ts); silencing keeps today's behavior
  suppressOnRouterTransitionStartWarning: true,
});
