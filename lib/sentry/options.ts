// Shared Sentry.init options for the browser (instrumentation-client.ts), Node (sentry.server.config.ts)
// and Edge (sentry.edge.config.ts) runtimes.
import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs'
import { scrubDeep } from './scrub'

export const SENTRY_DSN = 'https://28d0b1752adddcef43e6de7e5bdd7d77@o4510987282153472.ingest.us.sentry.io/4510987349000192'

export const sentryPrivacyOptions = {
  dsn: SENTRY_DSN,
  // Error reports only: no performance tracing (not described in the Privacy Policy)
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend: (event: ErrorEvent) => scrubDeep(event),
  beforeBreadcrumb: (breadcrumb: Breadcrumb) => scrubDeep(breadcrumb),
  debug: false,
}
