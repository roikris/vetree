// Last line of defence for everything sent to Sentry (a third party with its own retention).
// beforeSend → scrubEvent, beforeBreadcrumb → scrubBreadcrumb, in all three runtimes
// (lib/sentry/options.ts); the server also stops collecting request cookies/headers/body/query at
// the source (sentry.server.config.ts). sendDefaultPii:false alone is NOT enough: the Node SDK 9
// collects cookies, headers, bodies and query strings by default.
//
// ALLOWLIST, not a hunt for secrets: an event keeps only what fixing a bug needs — exception
// type/message, stack frames (no local variables), the route path, runtime/browser info. extra,
// tags, user, request headers/body/cookies, response bodies, frame vars and unknown breadcrumb data
// are dropped whole. The few free-text strings kept are scrubbed by scrubString:
//   1. query string / fragment after any "?" or "#" that starts key=value data (?code=…, #access_token=…)
//   2. JWTs, Bearer/Basic credentials, long opaque tokens → [token]
//   3. email addresses (incl. %40-encoded) → [email]
//   4. UUIDs (user ids) → [uuid]
// Each step is one forward pass (no backtracking); strings are capped first.

const MAX_STRING = 8192
const MAX_FRAMES = 100
const MAX_VALUES = 10

const isWordCh = (c: string) => /[A-Za-z0-9_.\-[\]%]/.test(c)
const isStop = (c: string) => /[\s"'<>`]/.test(c)

/** 1. Cut "?k=…" / "#k=…" (and "#/route?k=…") up to the next whitespace or quote. */
function stripQueryData(s: string): string {
  let out = ''
  let last = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c !== '?' && c !== '#') continue
    // Look ahead (bounded) for key= — or "#/" (hash route) — right after the delimiter
    let j = i + 1
    if (c === '#' && s[j] === '/') j++
    const keyStart = j
    while (j < s.length && j - keyStart < 64 && isWordCh(s[j])) j++
    const isData = (j > keyStart && s[j] === '=') || (c === '#' && s[i + 1] === '/')
    if (!isData) continue
    let end = i
    while (end < s.length && !isStop(s[end])) end++
    out += s.slice(last, i)
    last = end
    i = end - 1
  }
  return out + s.slice(last)
}

// 2. Credentials outside URLs. One pass over runs of token characters (a single greedy class, so
// no backtracking); a run is redacted only if it looks like a secret.
const TOKEN_RUN = /[A-Za-z0-9._~+/=-]{20,}/g
const AUTH_SCHEME = /\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi
function looksSecret(t: string): boolean {
  if (t.startsWith('eyJ') && t.split('.').length >= 3) return true          // JWT
  if (t.startsWith('base64-')) return true                                   // Supabase session cookie
  // Long opaque string: no dot (not a domain/file), not a path, mixes letters and digits
  return t.length >= 40 && !t.includes('.') && t[0] !== '/' && /[0-9]/.test(t) && /[A-Za-z]/.test(t)
}

// 3. Emails: find each "@" / "%40", expand left over local-part chars (≤64) and right over domain
const LOCAL_CH = /[A-Za-z0-9._%+-]/
const DOMAIN_CH = /[A-Za-z0-9.-]/
function maskEmails(s: string): string {
  if (!s.includes('@') && !s.includes('%40')) return s
  let out = ''
  let last = 0
  for (let i = 0; i < s.length; i++) {
    const width = s[i] === '@' ? 1 : s.startsWith('%40', i) ? 3 : 0
    if (!width) continue
    let l = i
    while (l > last && i - l < 64 && LOCAL_CH.test(s[l - 1])) l--
    let r = i + width
    while (r < s.length && r - i < 254 && DOMAIN_CH.test(s[r])) r++
    const domain = s.slice(i + width, r).replace(/[.-]+$/, '')
    if (l < i && /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(domain)) {
      out += s.slice(last, l) + '[email]'
      last = i + width + domain.length
      i = last - 1
    }
  }
  return out + s.slice(last)
}

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

const cap = (s: string) => (s.length > MAX_STRING ? s.slice(0, MAX_STRING) + '…[truncated]' : s)

export function scrubString(input: string): string {
  return maskEmails(
    stripQueryData(cap(input))
      .replace(AUTH_SCHEME, '$1 [token]')
      .replace(TOKEN_RUN, t => (looksSecret(t) ? '[token]' : t))
  ).replace(UUID, '[uuid]')
}

const str = (v: unknown) => (typeof v === 'string' ? scrubString(v) : undefined)
// Code locations (frame file names, source lines): only query data is cut — hashed chunk names
// must survive for source maps
const codeStr = (v: unknown) => (typeof v === 'string' ? stripQueryData(cap(v)) : undefined)
const raw = (v: unknown) => (typeof v === 'string' ? v : undefined)
const num = (v: unknown) => (typeof v === 'number' ? v : undefined)
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined)

/** Copy only the listed keys, each through its sanitizer; drops undefined. */
function pick(src: unknown, fields: Record<string, (v: unknown) => unknown>): Record<string, unknown> | undefined {
  if (!src || typeof src !== 'object') return undefined
  const out: Record<string, unknown> = {}
  for (const [k, fn] of Object.entries(fields)) {
    const v = fn((src as Record<string, unknown>)[k])
    if (v !== undefined) out[k] = v
  }
  return out
}

const arrayOf = (fn: (v: unknown) => unknown, max: number) => (v: unknown) =>
  Array.isArray(v) ? v.slice(-max).map(fn).filter(x => x !== undefined) : undefined

const strArray = (max: number) => arrayOf(str, max)

const frame = (f: unknown) => pick(f, {
  filename: codeStr, abs_path: codeStr, module: codeStr, function: codeStr, lineno: num, colno: num,
  in_app: bool, context_line: codeStr, pre_context: arrayOf(codeStr, 10), post_context: arrayOf(codeStr, 10),
  platform: raw,
  // vars (local variables) deliberately omitted
})

const exceptionValue = (e: unknown) => pick(e, {
  type: str, value: str, module: str,
  mechanism: (m: unknown) => pick(m, { type: str, handled: bool, synthetic: bool, source: str, exception_id: num, parent_id: num, is_exception_group: bool }),
  stacktrace: (st: unknown) => pick(st, { frames: arrayOf(frame, MAX_FRAMES) }),
})

// Breadcrumb data: only these keys (URLs/paths pass through scrubString)
const breadcrumbData = (d: unknown) => pick(d, {
  url: str, method: str, status_code: num, from: str, to: str, reason: str,
})

export function scrubBreadcrumb<T>(breadcrumb: T): T {
  return pick(breadcrumb, {
    type: str, category: str, level: str, timestamp: num, event_id: str,
    message: str,
    data: breadcrumbData,
  }) as T
}

// Contexts: SDK-provided environment info only (never response bodies or custom contexts)
const ctxFields = (keys: string[]) => (v: unknown) =>
  pick(v, Object.fromEntries(keys.map(k => [k, (x: unknown) => str(x) ?? num(x) ?? bool(x)])))

const contexts = (c: unknown) => pick(c, {
  os: ctxFields(['name', 'version', 'kernel_version', 'build']),
  browser: ctxFields(['name', 'version']),
  runtime: ctxFields(['name', 'version']),
  device: ctxFields(['family', 'model', 'arch', 'memory_size', 'processor_count', 'cpu_description', 'boot_time']),
  app: ctxFields(['app_start_time', 'app_memory']),
  culture: ctxFields(['locale', 'timezone']),
  cloud_resource: ctxFields(['cloud.provider', 'cloud.region']),
  trace: ctxFields(['trace_id', 'span_id', 'parent_span_id', 'op', 'status']),
  nextjs: ctxFields(['request_path', 'router_kind', 'router_path', 'route_type']),
})

/** beforeSend: rebuild the event from an allowlist. */
export function scrubEvent<T>(event: T): T {
  const e = event as Record<string, unknown>
  const out = pick(e, {
    event_id: str, timestamp: num, start_timestamp: num, platform: str, level: str, logger: str,
    environment: raw, release: raw, dist: raw, server_name: str, transaction: str, type: raw,
    fingerprint: strArray(10),
    message: (m: unknown) => typeof m === 'string' ? scrubString(m) : pick(m, { message: str, formatted: str }),
    logentry: (m: unknown) => pick(m, { message: str }),
    exception: (x: unknown) => pick(x, { values: arrayOf(exceptionValue, MAX_VALUES) }),
    breadcrumbs: arrayOf(scrubBreadcrumb, 100),
    request: (r: unknown) => pick(r, { url: str, method: str }),
    contexts,
    sdk: (v: unknown) => v,          // SDK name/version/integrations — no user data
    debug_meta: (v: unknown) => v,   // debug ids for source maps — must stay intact
  }) ?? {}
  return out as T
}
