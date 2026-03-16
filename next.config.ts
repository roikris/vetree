import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Enable Turbopack support (Next.js 16)
  turbopack: {},
};

// @ts-ignore - Sentry v7 types don't fully support Next.js 16 yet
export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
  telemetry: false,
});
