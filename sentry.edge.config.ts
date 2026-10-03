// Edge-runtime Sentry (middleware), loaded by instrumentation.ts register()
import * as Sentry from '@sentry/nextjs'
import { sentryPrivacyOptions } from './lib/sentry/options'

Sentry.init({
  ...sentryPrivacyOptions,
  environment: process.env.VERCEL_ENV ?? 'development',
  enabled: process.env.NODE_ENV === 'production',
})
