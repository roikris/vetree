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
};

// @ts-ignore - Sentry v7 types don't fully support Next.js 16 yet
export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
  telemetry: false,
});
