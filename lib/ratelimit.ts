import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Create a rate limiter for delete account endpoint (5 requests per minute per IP)
export const deleteAccountLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
  prefix: '@upstash/ratelimit/delete-account',
})

// Create a rate limiter for auth endpoints (10 requests per minute per IP)
export const authLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true,
  prefix: '@upstash/ratelimit/auth',
})

// Strict limiter for expensive operations like digest sending (3 requests per minute)
export const ratelimitStrict = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 m'),
  analytics: true,
  prefix: '@upstash/ratelimit/strict',
})

// Moderate limiter for AI endpoints like post generation (10 requests per minute)
export const ratelimitModerate = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true,
  prefix: '@upstash/ratelimit/moderate',
})

// Loose limiter for high-volume public endpoints like analytics (60 requests per minute)
export const ratelimitLoose = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  analytics: true,
  prefix: '@upstash/ratelimit/loose',
})

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
