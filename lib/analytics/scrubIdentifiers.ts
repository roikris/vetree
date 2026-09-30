/**
 * Removes account identifiers from anything sent outside Vetree for analysis (the Anthropic insights
 * prompt, Slack). Applied at that boundary, so identifiers can't leak whatever the database holds
 * (e.g. signals written by an older deployment). Keys that name users/emails are dropped; UUIDs and
 * email addresses inside strings are replaced. (Privacy review, 2026-09-30.)
 */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const IDENTIFIER_KEY_RE = /(^|_)(user|users|user_id|user_ids|email|emails|ip|ip_hash)(_|$)/i

export function scrubIdentifiers<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(UUID_RE, '[id]').replace(EMAIL_RE, '[email]') as T
  }
  if (Array.isArray(value)) return value.map(v => scrubIdentifiers(v)) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (IDENTIFIER_KEY_RE.test(k)) continue
      out[k] = scrubIdentifiers(v)
    }
    return out as T
  }
  return value
}
