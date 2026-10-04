// Shared Sentry.init options for the browser (instrumentation-client.ts), Node (sentry.server.config.ts)
// and Edge (sentry.edge.config.ts) runtimes. Error reports only, and every event and breadcrumb goes
// through lib/sentry/scrub.ts before it leaves the app.
import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs'
import { scrubBreadcrumb, scrubEvent } from './scrub'

export const SENTRY_DSN = 'https://28d0b1752adddcef43e6de7e5bdd7d77@o4510987282153472.ingest.us.sentry.io/4510987349000192'

export const sentryPrivacyOptions = {
  dsn: SENTRY_DSN,
  // Error reports only: no performance tracing (not described in the Privacy Policy)
  tracesSampleRate: 0,
  // Only stops automatic IP collection — everything else is handled by the allowlist in
  // scrubEvent / scrubBreadcrumb (and request data is switched off at the source on the server)
  sendDefaultPii: false,
  beforeSend: (event: ErrorEvent) => scrubEvent(event),
  beforeBreadcrumb: (breadcrumb: Breadcrumb) => scrubBreadcrumb(breadcrumb),
  debug: false,
}
