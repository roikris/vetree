// Browser-side Sentry. Next.js with Turbopack loads THIS file, not sentry.client.config.ts — until
// 2026-09-30 the client SDK was never initialised in production (no browser error reports and no
// session replay ever ran).
import * as Sentry from '@sentry/nextjs'
import { sentryPrivacyOptions } from './lib/sentry/options'

// Error reports only (no tracing, no session replay — removed 2026-09-30), emails scrubbed from
// events and breadcrumbs before sending (lib/sentry/scrub.ts)
Sentry.init(sentryPrivacyOptions)
