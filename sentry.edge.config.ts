// Edge-runtime Sentry, loaded by instrumentation.ts register(). Nothing runs on Edge since build-001 (proxy.ts
// uses the Node.js runtime, so its errors go through sentry.server.config.ts); kept for any future Edge route.
import * as Sentry from '@sentry/nextjs'
import { sentryPrivacyOptions } from './lib/sentry/options'

Sentry.init({
  ...sentryPrivacyOptions,
  environment: process.env.VERCEL_ENV ?? 'development',
  // Vercel deployments only (production + previews, labelled by environment) — never local builds
  enabled: !!process.env.VERCEL_ENV,
})
