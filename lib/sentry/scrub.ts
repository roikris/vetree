// Strip email addresses from everything sent to Sentry (a third party with its own retention).
// sendDefaultPii:false only stops automatic IP/cookie collection — it does not scrub text we hand
// it: console breadcrumbs (Sentry records console.* calls by default and attaches the recent ones to
// every error report) and error messages (e.g. JSON.parse quotes the bad input). Applied in
// beforeSend + beforeBreadcrumb by every runtime (lib/sentry/options.ts).

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi
const MAX_DEPTH = 10

export function scrubString(s: string): string {
  return s.replace(EMAIL, '[email]')
}

/** Deep copy with every string scrubbed. Non-plain objects (Dates, Errors, class instances) are kept as-is. */
export function scrubDeep<T>(value: T, depth = 0): T {
  if (typeof value === 'string') return scrubString(value) as T
  if (value === null || typeof value !== 'object' || depth > MAX_DEPTH) return value
  if (Array.isArray(value)) return value.map(v => scrubDeep(v, depth + 1)) as T
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = scrubDeep(v, depth + 1)
  return out as T
}
