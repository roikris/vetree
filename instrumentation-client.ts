// Browser-side Sentry. Next.js with Turbopack loads THIS file, not sentry.client.config.ts — until
// 2026-09-30 the client SDK was never initialised in production (no browser error reports and no
// session replay ever ran).
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://28d0b1752adddcef43e6de7e5bdd7d77@o4510987282153472.ingest.us.sentry.io/4510987349000192',

  // Error reports only: no performance tracing (not described in the Privacy Policy)
  tracesSampleRate: 0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // No session replay (removed 2026-09-30: never ran in production, and not worth a separate
  // consent choice)
})
