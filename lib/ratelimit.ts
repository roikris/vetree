import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Helper to get client IP
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  return 'unknown'
}

// A no-op limiter that always allows requests.
// Used when Upstash env vars are absent in non-production environments.
// Fail-open: no rate limiting rather than crashing the route.
const noopLimiter = {
  limit: async () => ({ success: true as const, limit: Infinity, remaining: Infinity, reset: 0, pending: Promise.resolve() }),
  blockUntilReady: async () => ({ success: true as const, limit: Infinity, remaining: Infinity, reset: 0, pending: Promise.resolve() }),
} as unknown as Ratelimit

function reportMissingUpstash() {
  const msg = '[ratelimit] Upstash env missing in PRODUCTION — failing open (no rate limiting)'
  console.error(msg)
  // Report to Sentry if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/nextjs')
    Sentry.captureMessage(msg, 'error')
  } catch {
    // Sentry not available — console.error above is sufficient
  }
}

function makeRatelimit(prefix: string, limiter: ReturnType<typeof Ratelimit.slidingWindow>): Ratelimit {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (process.env.VERCEL_ENV === 'production') {
      reportMissingUpstash()
    }
    return noopLimiter
  }
  try {
    return new Ratelimit({
      redis: Redis.fromEnv(),
      limiter,
      analytics: true,
      prefix,
    })
  } catch (err) {
    if (process.env.VERCEL_ENV === 'production') {
      reportMissingUpstash()
    }
    return noopLimiter
  }
}

// Create a rate limiter for delete account endpoint (5 requests per minute per IP)
export const deleteAccountLimiter = makeRatelimit(
  '@upstash/ratelimit/delete-account',
  Ratelimit.slidingWindow(5, '1 m'),
)

// Create a rate limiter for auth endpoints (10 requests per minute per IP)
export const authLimiter = makeRatelimit(
  '@upstash/ratelimit/auth',
  Ratelimit.slidingWindow(10, '1 m'),
)

// Strict limiter for expensive operations like digest sending (3 requests per minute)
export const ratelimitStrict = makeRatelimit(
  '@upstash/ratelimit/strict',
  Ratelimit.slidingWindow(3, '1 m'),
)

// Moderate limiter for AI endpoints like post generation (10 requests per minute)
export const ratelimitModerate = makeRatelimit(
  '@upstash/ratelimit/moderate',
  Ratelimit.slidingWindow(10, '1 m'),
)

// Loose limiter for high-volume public endpoints like analytics (60 requests per minute)
export const ratelimitLoose = makeRatelimit(
  '@upstash/ratelimit/loose',
  Ratelimit.slidingWindow(60, '1 m'),
)
