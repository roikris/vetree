// Node-runtime Sentry, loaded by instrumentation.ts register(). Until 2026-10-03 there was no
// instrumentation.ts, so this file never ran: no server-side error ever reached Sentry (the
// "fail loud" production alerts of CLAUDE.md rule 13 included).
import * as Sentry from '@sentry/nextjs'
import { sentryPrivacyOptions } from './lib/sentry/options'

Sentry.init({
  ...sentryPrivacyOptions,
  environment: process.env.VERCEL_ENV ?? 'development',
  enabled: process.env.NODE_ENV === 'production',
})
