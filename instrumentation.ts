// Next.js server instrumentation: @sentry/nextjs v9 initialises the server and edge SDKs only from
// here (sentry.server.config.ts / sentry.edge.config.ts are not loaded on their own).
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

// Uncaught errors in server components, route handlers and the proxy (proxy.ts)
export const onRequestError = Sentry.captureRequestError
