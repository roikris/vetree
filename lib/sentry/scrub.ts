// Last line of defence for everything sent to Sentry (a third party with its own retention).
// Applied in beforeSend + beforeBreadcrumb by all three runtimes (lib/sentry/options.ts); the
// server additionally turns off request cookies/headers/body/query collection at the source
// (sentry.server.config.ts). sendDefaultPii:false alone is NOT enough: in @sentry/nextjs 9 the
// Node SDK still collects cookies, headers, bodies and query strings by default.
//
// Every string: email addresses → [email], UUIDs (user ids) → [uuid], and the query string /
// fragment of any URL or path is cut (auth codes, reset tokens, signed-URL credentials live
// there — e.g. /auth/callback?code=…). Linear-time scans with size budgets: a scrubber must never
// be the slow part of error handling.

const MAX_DEPTH = 10
const MAX_NODES = 3000        // objects/arrays/strings visited per event
const MAX_STRING = 8192       // longer strings are cut first (Sentry truncates anyway)

// Object keys dropped wherever they appear (lower-cased)
const DROP_KEYS = new Set([
  'cookies', 'cookie', 'set-cookie', 'authorization', 'proxy-authorization',
  'query_string', 'http.query', 'http.fragment', 'x-forwarded-for', 'x-real-ip',
  'x-vercel-forwarded-for', 'x-vercel-ip', 'apikey', 'x-supabase-auth',
])

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
const LOCAL_CH = /[A-Za-z0-9._%+\-!#$&'*/=?^`{|}~]/
const DOMAIN_CH = /[A-Za-z0-9.\-]/
const TOKEN_END = /[\s"'<>()[\]{},\\]/

function maskEmails(s: string): string {
  if (!s.includes('@') && !s.includes('%40')) return s
  let out = ''
  let last = 0
  for (let i = 0; i < s.length; i++) {
    const encoded = s.startsWith('%40', i)
    if (s[i] !== '@' && !encoded) continue
    const at = encoded ? 3 : 1
    let l = i
    while (l > last && i - l < 64 && LOCAL_CH.test(s[l - 1])) l--
    let r = i + at
    while (r < s.length && r - i < 254 && DOMAIN_CH.test(s[r])) r++
    const domain = s.slice(i + at, r).replace(/\.+$/, '')
    if (l < i && /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(domain)) {
      out += s.slice(last, l) + '[email]'
      last = i + at + domain.length
      i = last - 1
    }
  }
  return out + s.slice(last)
}

/** Cut "?…" / "#…" from tokens that are or contain a URL (http(s)://…) or start as a path (/…). */
function stripQueries(s: string): string {
  if (!s.includes('?') && !s.includes('#')) return s
  let out = ''
  let last = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '?' && s[i] !== '#') continue
    let start = i
    while (start > last && !TOKEN_END.test(s[start - 1])) start--
    const token = s.slice(start, i)
    if (!/^\/|https?:\/\//i.test(token)) continue
    let end = i
    while (end < s.length && !TOKEN_END.test(s[end])) end++
    out += s.slice(last, i)
    last = end
    i = end - 1
  }
  return out + s.slice(last)
}

export function scrubString(input: string): string {
  const s = input.length > MAX_STRING ? input.slice(0, MAX_STRING) + '…[truncated]' : input
  return stripQueries(maskEmails(s)).replace(UUID, '[uuid]')
}

/** Deep copy with every string scrubbed and DROP_KEYS removed. Budgeted: never slow, never deep. */
export function scrubDeep<T>(value: T): T {
  let nodes = 0
  const walk = (v: unknown, depth: number): unknown => {
    if (++nodes > MAX_NODES) return '[truncated]'
    if (typeof v === 'string') return scrubString(v)
    if (v === null || typeof v !== 'object') return v
    if (depth >= MAX_DEPTH) return '[truncated]'
    if (Array.isArray(v)) return v.map(x => walk(x, depth + 1))
    if (v instanceof Date) return v
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (DROP_KEYS.has(k.toLowerCase())) continue
      out[k] = walk(x, depth + 1)
    }
    return out
  }
  return walk(value, 0) as T
}

type SentryEventLike = {
  user?: unknown
  request?: { url?: string; method?: string; headers?: Record<string, string> } & Record<string, unknown>
} & Record<string, unknown>

/** beforeSend: keep only url (scrubbed), method and user-agent of the request; drop the user. */
export function scrubEvent<T>(event: T): T {
  const e = { ...(event as SentryEventLike) }
  delete e.user
  if (e.request) {
    const ua = e.request.headers?.['user-agent'] ?? e.request.headers?.['User-Agent']
    e.request = {
      ...(e.request.url ? { url: e.request.url } : {}),
      ...(e.request.method ? { method: e.request.method } : {}),
      ...(ua ? { headers: { 'user-agent': ua } } : {}),
    }
  }
  return scrubDeep(e) as T
}
