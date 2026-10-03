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

const isStop = (c: string) => /[\s"'<>`]/.test(c)

/** 1. Free text: cut "?…" / "#…" when the token after it carries data (contains = or &, or is a
 *  hash route "#/…") — up to the next whitespace or quote. Linear: a scanned token is never rescanned. */
function stripQueryData(s: string): string {
  let out = ''
  let last = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c !== '?' && c !== '#') continue
    let end = i + 1
    let isData = c === '#' && s[i + 1] === '/'
    while (end < s.length && !isStop(s[end])) {
      if (s[end] === '=' || s[end] === '&') isData = true
      end++
    }
    if (isData) {
      out += s.slice(last, i)
      last = end
    }
    i = end - 1   // every ?/# inside this token shares the same tail: never rescan it
  }
  return out + s.slice(last)
}

/** Known URL fields: the whole query and fragment go, unconditionally. */
function cutQuery(s: string): string {
  const q = s.search(/[?#]/)
  return q < 0 ? s : s.slice(0, q)
}

// 2. Credentials outside URLs. One pass over runs of token characters (a single greedy class, so
// no backtracking); a run is redacted only if it looks like a secret.
const TOKEN_RUN = /[A-Za-z0-9._~+/=-]{20,}/g
const AUTH_SCHEME = /\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{4,}/gi
const B64URL = /^[A-Za-z0-9_-]+$/

/** Does this base64url text decode to something starting with "{" (after any whitespace)? */
function decodesToJsonObject(seg: string): boolean {
  if (seg.length < 10 || !B64URL.test(seg)) return false
  try {
    const head = seg.slice(0, 24).replace(/-/g, '+').replace(/_/g, '/')
    return atob(head.slice(0, head.length - (head.length % 4))).trimStart().startsWith('{')
  } catch {
    return false
  }
}

// A JWT anywhere in the run, by meaning: a segment that decodes to a JSON object, a dot, and a
// payload segment — however the JSON was serialised. Each segment is examined once (bounded decode).
function looksJwt(t: string): boolean {
  const segs = t.split('.')
  for (let k = 0; k + 1 < segs.length; k++) {
    const seg = segs[k]
    // the header starts after any non-base64url character the run allows (/, =, +, ~)
    const start = Math.max(seg.lastIndexOf('/'), seg.lastIndexOf('='), seg.lastIndexOf('+'), seg.lastIndexOf('~')) + 1
    if (decodesToJsonObject(seg.slice(start)) && /^[A-Za-z0-9_-]{8}/.test(segs[k + 1])) return true
  }
  return false
}
const hasSessionBlob = (t: string) => t.includes('base64-')                  // Supabase session cookie, any prefix
// Opaque secret: any piece of the run (split on / . = + ~) of ≥32 chars mixing letters and digits
const hasOpaquePiece = (t: string) =>
  t.split(/[/.=+~]/).some(p => p.length >= 32 && /[0-9]/.test(p) && /[A-Za-z]/.test(p))
const looksSecret = (t: string) => looksJwt(t) || hasSessionBlob(t) || hasOpaquePiece(t)

// 3. Emails: find each "@", expand left over local-part chars (≤64) and right over domain chars,
// Unicode included. Percent-encoded "@" and "." are decoded first (synthetic%40example%2Etest).
const LOCAL_CH = /[\p{L}\p{N}._%+-]/u
const DOMAIN_CH = /[\p{L}\p{N}.-]/u
const DOMAIN = /^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)*\.(\p{L}{2,}|xn--[a-z0-9-]{2,})$/iu
function maskEmails(input: string): string {
  const s = /%(40|2e)/i.test(input) ? input.replace(/%40/gi, '@').replace(/%2e/gi, '.') : input
  if (!s.includes('@')) return s
  let out = ''
  let last = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '@') continue
    let l = i
    while (l > last && i - l < 64 && LOCAL_CH.test(s[l - 1])) l--
    let r = i + 1
    while (r < s.length && r - i < 254 && DOMAIN_CH.test(s[r])) r++
    const domain = s.slice(i + 1, r).replace(/[.-]+$/, '')
    if (l < i && DOMAIN.test(domain)) {
      out += s.slice(last, l) + '[email]'
      last = i + 1 + domain.length
      i = last - 1
    }
  }
  return out + s.slice(last)
}

// 4. UUIDs, with no word boundary (user_<uuid> too)
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

const cap = (s: string) => (s.length > MAX_STRING ? s.slice(0, MAX_STRING) + '…[truncated]' : s)

export function scrubString(input: string): string {
  return maskEmails(
    stripQueryData(cap(input))
      .replace(AUTH_SCHEME, '$1 [token]')
      .replace(TOKEN_RUN, t => (looksSecret(t) ? '[token]' : t))
  ).replace(UUID, '[uuid]')
}

/**
 * URL / path fields keep only the route SHAPE: query and fragment removed, credentials in the
 * authority removed, and every path segment that is not a plain lowercase word (or vN, or a
 * [param] pattern) becomes ":id". Tokens, ids, emails and JWTs in paths disappear by construction:
 * /reset/<token> → /reset/:id, /article/pubmed-123 → /article/:id.
 */
const SAFE_SEGMENT = /^_?[a-z][a-z_-]{0,40}$|^v\d{1,2}$|^\[{1,2}(\.\.\.)?[a-z_]+\]{1,2}$/
export function routeShape(input: string): string {
  const s = cutQuery(cap(input))
  const m = /^([a-z][a-z0-9+.-]*:\/\/)([^/]*)(.*)$/i.exec(s)
  const origin = m ? m[1] + m[2].slice(m[2].lastIndexOf('@') + 1) : ''
  const path = m ? m[3] : s
  if (!m && !path.startsWith('/')) return scrubString(path)          // not a URL or path: free text
  return origin + path.split('/').map(seg => (seg === '' || SAFE_SEGMENT.test(seg) ? seg : ':id')).join('/')
}

const str = (v: unknown) => (typeof v === 'string' ? scrubString(v) : undefined)
const urlStr = (v: unknown) => (typeof v === 'string' ? routeShape(v) : undefined)
// Code file names (frames, debug images) must keep their real names for source maps: the query is
// cut and everything secret-looking masked EXCEPT pure-hex pieces — bundler chunk hashes are hex
// (0a1b2c…), opaque credentials mix cases/letters beyond a-f.
const hasOpaqueNonHexPiece = (t: string) =>
  t.split(/[/.=+~]/).some(p => p.length >= 32 && /[0-9]/.test(p) && /[A-Za-z]/.test(p) && !/^[0-9a-f]+$/.test(p))
const fileStr = (v: unknown) => (typeof v === 'string'
  ? maskEmails(
      cutQuery(cap(v))
        .replace(AUTH_SCHEME, '$1 [token]')
        .replace(TOKEN_RUN, t => (looksJwt(t) || hasSessionBlob(t) || hasOpaqueNonHexPiece(t) ? '[token]' : t))
    ).replace(UUID, '[uuid]')
  : undefined)
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
  filename: fileStr, abs_path: fileStr, module: fileStr, function: str, lineno: num, colno: num,
  in_app: bool, context_line: str, pre_context: strArray(10), post_context: strArray(10),
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
  url: urlStr, method: str, status_code: num, from: urlStr, to: urlStr, reason: str,
})

export function scrubBreadcrumb<T>(breadcrumb: T): T {
  // Free-form text breadcrumbs keep only their category (when + kind, never content):
  // - ui.* (DOM): element selectors, and labels can hold what the reader typed (the zero-results
  //   "Synthesize evidence for <query>" button); switched off in the browser anyway
  // - console: any console.* line from any code path (search text, ids, error dumps) — logs stay
  //   in Vercel's logs, never in Sentry
  const category = (breadcrumb as { category?: unknown })?.category
  if (typeof category === 'string' && (category.startsWith('ui.') || category === 'console')) {
    return pick(breadcrumb, { type: str, category: str, level: str, timestamp: num }) as T
  }
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
  nextjs: (v: unknown) => pick(v, { request_path: urlStr, router_kind: str, router_path: urlStr, route_type: str }),
})

/** beforeSend: rebuild the event from an allowlist. */
export function scrubEvent<T>(event: T): T {
  const e = event as Record<string, unknown>
  const out = pick(e, {
    event_id: str, timestamp: num, start_timestamp: num, platform: str, level: str, logger: str,
    environment: raw, release: raw, dist: raw, server_name: str, type: raw,
    transaction: (v: unknown) => (typeof v === 'string'
      ? v.replace(/^([A-Z]+ )?(.*)$/, (_, method = '', rest) => method + routeShape(rest))
      : undefined),
    fingerprint: strArray(10),
    message: (m: unknown) => typeof m === 'string' ? scrubString(m) : pick(m, { message: str, formatted: str }),
    logentry: (m: unknown) => pick(m, { message: str }),
    exception: (x: unknown) => pick(x, { values: arrayOf(exceptionValue, MAX_VALUES) }),
    breadcrumbs: arrayOf(scrubBreadcrumb, 100),
    request: (r: unknown) => pick(r, { url: urlStr, method: str }),
    contexts,
    sdk: (v: unknown) => v,          // SDK name/version/integrations — no user data
    // Debug ids for source maps must stay intact; image file names are URLs like frame file names
    debug_meta: (v: unknown) => pick(v, {
      images: arrayOf((img: unknown) => pick(img, {
        type: raw, debug_id: raw, code_id: raw, code_file: fileStr, image_addr: raw, image_size: num, arch: raw,
      }), 200),
    }),
  }) ?? {}
  return out as T
}
