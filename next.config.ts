import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Enable Turbopack support (Next.js 16)
  turbopack: {},
};

export default withSentryConfig(nextConfig, {
  // Sentry configuration options
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
});
