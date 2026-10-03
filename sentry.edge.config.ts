// Edge-runtime Sentry (middleware), loaded by instrumentation.ts register()
import * as Sentry from '@sentry/nextjs'
import { sentryPrivacyOptions } from './lib/sentry/options'

Sentry.init({
  ...sentryPrivacyOptions,
  environment: process.env.VERCEL_ENV ?? 'development',
  // Vercel deployments only (production + previews, labelled by environment) — never local builds
  enabled: !!process.env.VERCEL_ENV,
})
