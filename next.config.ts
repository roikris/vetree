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
});
