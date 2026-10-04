// Node-runtime Sentry, loaded by instrumentation.ts register(). Until 2026-10-03 there was no
// instrumentation.ts, so this file never ran: no server-side error ever reached Sentry (the
// "fail loud" production alerts of CLAUDE.md rule 13 included).
import * as Sentry from '@sentry/nextjs'
import { sentryPrivacyOptions } from './lib/sentry/options'

Sentry.init({
  ...sentryPrivacyOptions,
  environment: process.env.VERCEL_ENV ?? 'development',
  // Vercel deployments only (production + previews, labelled by environment) — never local builds
  enabled: !!process.env.VERCEL_ENV,
  integrations: [
    // The Node SDK's defaults collect cookies, all headers, request bodies and query strings even
    // with sendDefaultPii:false. Collect the URL only (scrubbed again in beforeSend).
    Sentry.requestDataIntegration({
      include: { cookies: false, data: false, headers: false, ip: false, query_string: false, url: true },
    }),
    // disableIncomingRequestSpans: the Next.js default this replacement must keep
    Sentry.httpIntegration({ maxIncomingRequestBodySize: 'none', disableIncomingRequestSpans: true }),
  ],
})
