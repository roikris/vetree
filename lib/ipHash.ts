import { createHash } from 'crypto'

// One IP hash for every place an IP-derived key leaves the request: page_views / search_logs / analytics_events
// ip_hash, and the Upstash rate-limit keys (analytics-001 — before, the limiters got the raw IP, which Upstash
// stores in its keys and analytics). The scheme is unchanged from the tracking routes, so existing hashes still
// match. IP_HASH_SALT is set in every Vercel environment; if production ever lacks it, say so loudly (the literal
// fallback keeps hashes stable, but anyone can recompute them).

let warned = false

function salt(): string {
  const s = process.env.IP_HASH_SALT
  if (s) return s
  if (process.env.VERCEL_ENV === 'production' && !warned) {
    warned = true
    const msg = '[ipHash] IP_HASH_SALT missing in PRODUCTION — IP hashes use the public fallback salt'
    console.error(msg)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@sentry/nextjs').captureMessage(msg, 'error')
    } catch {
      // Sentry unavailable — console.error above is enough
    }
  }
  return 'vetree-salt'
}

export function hashIP(ip: string): string {
  return createHash('sha256').update(ip + salt()).digest('hex')
}
