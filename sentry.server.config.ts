import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://28d0b1752adddcef43e6de7e5bdd7d77@o4510987282153472.ingest.us.sentry.io/4510987349000192',

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
})
