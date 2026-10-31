// Pure helpers for search-console.js (analytics-001, migration 088) — no network, no environment; unit-tested in
// tests/unit/searchConsole.test.ts. Plain CommonJS: the workflow runs it with Node 20 directly.
const crypto = require('crypto')

const SITE = 'sc-domain:vetree.app'
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const TOKEN_URI = 'https://oauth2.googleapis.com/token'
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer'
const ROW_LIMIT = 25000           // per request (API maximum)
const DAILY_ROW_CAP = 50000       // Google's daily export limit per search type: reaching it = truncated
const RETENTION_MONTHS = 16       // Google keeps Search Console data for 16 months
const LOOKBACK_MAX = 60

// Errors whose message is safe to print (no key material, no response text)
const safeError = message => Object.assign(new Error(message), { safe: true })

const b64url = buf => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

// The key file's shape (never echoed). Returns the two fields the flow needs.
function parseServiceAccount(raw) {
  let key
  try { key = JSON.parse(raw) } catch { throw safeError('GSC_SERVICE_ACCOUNT_JSON is not valid JSON') }
  if (!key || key.type !== 'service_account') throw safeError('GSC_SERVICE_ACCOUNT_JSON is not a service account key')
  if (typeof key.client_email !== 'string' || !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(key.client_email)) {
    throw safeError('GSC_SERVICE_ACCOUNT_JSON has no valid client_email')
  }
  if (typeof key.private_key !== 'string' || !key.private_key.includes('PRIVATE KEY')) {
    throw safeError('GSC_SERVICE_ACCOUNT_JSON has no private_key')
  }
  if (key.token_uri !== undefined && key.token_uri !== TOKEN_URI) throw safeError('GSC_SERVICE_ACCOUNT_JSON has an unexpected token_uri')
  return { clientEmail: key.client_email, privateKey: key.private_key }
}

// RS256 JWT for Google's service-account flow: no `sub` (no impersonation), one hour at most.
function buildJwt({ clientEmail, privateKey }, nowSeconds) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = { iss: clientEmail, scope: SCOPE, aud: TOKEN_URI, iat: nowSeconds, exp: nowSeconds + 3600 }
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`
  let signature
  try {
    signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey)
  } catch {
    throw safeError('could not sign the token with the service account key')   // never the key or the library's text
  }
  return `${unsigned}.${b64url(signature)}`
}

// ---- Dates (Search Console days are Pacific time) -------------------------------------------------------------
const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
function pacificDate(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
// Calendar arithmetic on YYYY-MM-DD strings (UTC noon avoids any DST edge)
function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
// The same day N calendar months earlier, clamped to the month's end (2026-03-31 − 1 month = 2026-02-28)
function monthsBack(day, months) {
  const [y, m, d] = day.split('-').map(Number)
  const total = y * 12 + (m - 1) - months
  const ty = Math.floor(total / 12), tm = total % 12
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
  return `${String(ty).padStart(4, '0')}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

function parseLookback(raw) {
  if (raw === undefined || raw === '') return 10
  if (!/^\d+$/.test(String(raw))) throw safeError(`GSC_DAYS must be an integer 1..${LOOKBACK_MAX}`)
  const n = Number(raw)
  if (n < 1 || n > LOOKBACK_MAX) throw safeError(`GSC_DAYS must be an integer 1..${LOOKBACK_MAX}`)
  return n
}

// Which days this run imports and which it marks expired.
//   requested: the last `lookback` consecutive dates ending yesterday (Pacific).
//   repair:    every day recorded as 'failed' or not final ('expired' excluded), and every date with no record between
//              the earliest record (the coverage boundary) and yesterday — no age limit inside Google's retention.
//   expire:    candidates older than Google's 16-month retention (never imported; their status becomes 'expired').
// importDays: [{ day, status, final }] from search_console_import_days.
function selectDays({ todayPt, lookback, importDays }) {
  const yesterday = addDays(todayPt, -1)
  const horizon = monthsBack(todayPt, RETENTION_MONTHS)   // oldest day Google still holds
  const known = new Map(importDays.map(r => [r.day, r]))
  const candidates = new Set()
  for (let i = lookback - 1; i >= 0; i--) candidates.add(addDays(yesterday, -i))
  for (const r of importDays) {
    if (r.status === 'failed' || (r.status === 'ok' && !r.final)) candidates.add(r.day)
  }
  if (importDays.length) {
    // Gaps are only filled inside Google's retention: a date before it with no record has nothing to expire
    const earliest = importDays.map(r => r.day).sort()[0]
    for (let d = earliest < horizon ? horizon : earliest; d <= yesterday; d = addDays(d, 1)) if (!known.has(d)) candidates.add(d)
  }
  const toImport = [], toExpire = []
  for (const day of [...candidates].sort()) {
    if (day > yesterday) continue
    if (day < horizon) { if (known.has(day) && known.get(day).status !== 'expired') toExpire.push(day) }
    else toImport.push(day)
  }
  return { toImport, toExpire, horizon }
}

// A day is final only when every response says so. Google sends metadata.firstIncompleteDate when part of the range
// is still being processed (dataState 'all' grouped by date); if a response carries no metadata, the heuristic
// "complete after three days" stands in for it.
function responseFinal(day, response, todayPt) {
  const meta = response && response.metadata
  const first = meta && (meta.firstIncompleteDate || meta.first_incomplete_date)
  if (isDay(first)) return day < first
  if (meta && meta.firstIncompleteHour) return false
  return day <= addDays(todayPt, -3)   // heuristic
}
const dayFinal = (day, responses, todayPt) => responses.every(r => responseFinal(day, r, todayPt))

// Google's URL → the stored identity (verbatim) + host and path for display / joining.
function parsePage(url) {
  let u
  try { u = new URL(url) } catch { return { page_url: String(url), host: '', path: '' } }
  return { page_url: String(url), host: u.hostname.toLowerCase(), path: u.pathname || '/' }
}

const metrics = r => ({
  clicks: Number(r.clicks) || 0,
  impressions: Number(r.impressions) || 0,
  ctr: typeof r.ctr === 'number' ? r.ctr : null,
  position: typeof r.position === 'number' ? r.position : null,
})

// Request bodies for one day. Every request groups by date so Google reports the day's completeness.
function requestBody(day, extraDimension, startRow) {
  return {
    startDate: day, endDate: day, type: 'web', dataState: 'all',
    dimensions: extraDimension ? ['date', extraDimension] : ['date'],
    rowLimit: ROW_LIMIT, startRow,
  }
}

// Fetches every page of one request. fetchPage(startRow) → parsed response. A failure anywhere throws (the day is
// then not written). Returns { rows, responses, truncated }.
async function fetchAllRows(fetchPage) {
  const rows = [], responses = []
  for (let startRow = 0; ; startRow += ROW_LIMIT) {
    const res = await fetchPage(startRow)
    responses.push(res)
    const page = Array.isArray(res && res.rows) ? res.rows : []
    rows.push(...page)
    if (page.length < ROW_LIMIT || rows.length >= DAILY_ROW_CAP) break
  }
  return { rows, responses, truncated: rows.length >= DAILY_ROW_CAP }
}

// The RPC payloads for one day from the three requests' rows (keys[0] is the date).
function toPayload({ dailyRows, queryRows, pageRows }) {
  return {
    daily: dailyRows.slice(0, 1).map(metrics),
    queries: queryRows.map(r => ({ query: String(r.keys[1]), ...metrics(r) })),
    pages: pageRows.map(r => ({ ...parsePage(r.keys[1]), ...metrics(r) })),
  }
}

// What an error may say in logs and Slack: the HTTP status and Google's error status / reason — never a body, a key
// or a token. Max 200 characters (the column's limit).
function sanitizedError(e) {
  if (e && e.gsc) {
    const parts = [`HTTP ${e.gsc.status}`]
    if (e.gsc.googleStatus) parts.push(String(e.gsc.googleStatus).replace(/[^A-Z_]/g, '').slice(0, 40))
    if (e.gsc.reason) parts.push(String(e.gsc.reason).replace(/[^A-Za-z_]/g, '').slice(0, 40))
    if (e.gsc.status === 403) parts.push('(no access to ' + SITE + ' or the API is not enabled)')
    return `${e.gsc.what}: ${parts.join(' ')}`.slice(0, 200)
  }
  if (e && e.safe) return String(e.message).slice(0, 200)
  return 'unexpected error (details withheld)'
}

// Builds the error thrown for a non-2xx Google response from its status and the parsed body's error fields only.
function googleError(what, status, body) {
  const err = new Error(what)
  const g = body && body.error
  err.gsc = {
    what, status,
    googleStatus: g && typeof g.status === 'string' ? g.status : undefined,
    reason: g && Array.isArray(g.errors) && g.errors[0] && typeof g.errors[0].reason === 'string' ? g.errors[0].reason : undefined,
  }
  return err
}

module.exports = {
  SITE, SCOPE, TOKEN_URI, GRANT_TYPE, ROW_LIMIT, DAILY_ROW_CAP, RETENTION_MONTHS, LOOKBACK_MAX,
  parseServiceAccount, buildJwt, pacificDate, addDays, monthsBack, parseLookback, selectDays,
  responseFinal, dayFinal, parsePage, requestBody, fetchAllRows, toPayload, sanitizedError, googleError,
}
