// Daily Google Search Console import (analytics-001, migration 088). Run by .github/workflows/search-console.yml.
// Reads sc-domain:vetree.app with a read-only service account (GSC_SERVICE_ACCOUNT_JSON) and writes one Pacific day
// at a time through replace_search_console_day(). Days that fail are recorded as 'failed' and retried by every later
// run until they are imported and final; see selectDays() in search-console-lib.js.
// Never prints the key, a token or a response body: errors carry an HTTP status and Google's error reason only.
// runImport() takes its dependencies (env, fetch, db, clock, log) so tests/unit/searchConsoleRun.test.ts can drive it.
const lib = require('./search-console-lib')

const safe = message => Object.assign(new Error(message), { safe: true })
const dbError = (what, error) => safe(`${what} failed (${(error && error.code) || 'error'})`)

// Every import_days row, 1,000 at a time in day order (the table is never purged, PostgREST caps a read at 1,000)
async function readImportDays(db) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('search_console_import_days').select('day, status, final')
      .order('day').range(from, from + 999)
    if (error) throw dbError('reading search_console_import_days', error)
    out.push(...(data || []))
    if (!data || data.length < 1000) return out
  }
}

async function runImport({ env, fetch, db, now = () => new Date(), log = console.log }) {
  const mask = value => { for (const line of String(value).split('\n')) if (line.trim()) log(`::add-mask::${line.trim()}`) }
  const slack = async text => {
    if (!env.SLACK_WEBHOOK_URL) return
    await fetch(env.SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      .catch(() => { /* best effort */ })
  }

  try {
    const lookback = lib.parseLookback(env.GSC_DAYS)
    if (!env.GSC_SERVICE_ACCOUNT_JSON) throw safe('GSC_SERVICE_ACCOUNT_JSON is not set')
    const account = lib.parseServiceAccount(env.GSC_SERVICE_ACCOUNT_JSON)
    mask(account.privateKey)

    const accessToken = async () => {
      const jwt = lib.buildJwt(account, Math.floor(now().getTime() / 1000))
      mask(jwt)
      const res = await fetch(lib.TOKEN_URI, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: lib.GRANT_TYPE, assertion: jwt }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body || typeof body.access_token !== 'string') {
        const err = new Error('token')
        err.gsc = { what: 'token exchange', status: res.status, reason: body && typeof body.error === 'string' ? body.error : undefined }
        throw err
      }
      mask(body.access_token)
      return body.access_token
    }
    const query = (token, day, dimension) => {
      const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(lib.SITE)}/searchAnalytics/query`
      const what = `query ${day} ${dimension || 'totals'}`
      return lib.fetchAllRows(async startRow => {
        const res = await fetch(url, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(lib.requestBody(day, dimension, startRow)),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok) throw lib.googleError(what, res.status, body)
        return lib.checkResponse(what, body, dimension ? 2 : 1)
      })
    }

    const importDays = await readImportDays(db)
    const todayPt = lib.pacificDate(now())
    const { toImport, toExpire, horizon } = lib.selectDays({ todayPt, lookback, importDays })
    log(`Pacific today ${todayPt}; lookback ${lookback}; importing ${toImport.length} day(s)` +
      (toImport.length ? ` ${toImport[0]} … ${toImport[toImport.length - 1]}` : '') + `; retention horizon ${horizon}`)

    // Days older than Google's retention can never be imported: record that once
    if (toExpire.length) {
      const { error } = await db.from('search_console_import_days')
        .update({ status: 'expired', last_error: 'beyond Search Console retention', attempted_at: now().toISOString() })
        .in('day', toExpire)
      if (error) throw dbError('marking expired days', error)
    }

    // Before any request, every day of this run is durably retryable: new days are recorded as 'failed', and days
    // already imported lose `final` (their data stays; a successful import restores it). So a crash, a failed day or
    // a status write that fails later can never leave a day looking done.
    const known = new Set(importDays.map(r => r.day))
    const fresh = toImport.filter(d => !known.has(d)).map(day => ({ day, status: 'failed', final: false, last_error: 'not attempted yet' }))
    if (fresh.length) {
      const { error } = await db.from('search_console_import_days').upsert(fresh, { onConflict: 'day', ignoreDuplicates: true })
      if (error) throw dbError('recording pending days', error)
    }
    const again = toImport.filter(d => known.has(d))
    if (again.length) {
      const { error } = await db.from('search_console_import_days').update({ final: false }).in('day', again)
      if (error) throw dbError('marking days for re-import', error)
    }

    const token = toImport.length ? await accessToken() : null
    const failed = []
    for (const day of toImport) {
      try {
        const totals = await query(token, day, null)
        const queries = await query(token, day, 'query')
        const pages = await query(token, day, 'page')
        const final = lib.dayFinal(day, [...totals.responses, ...queries.responses, ...pages.responses], todayPt)
        const payload = lib.toPayload({ dailyRows: totals.rows, queryRows: queries.rows, pageRows: pages.rows })
        const { data, error } = await db.rpc('replace_search_console_day', {
          p_day: day, p_final: final, p_daily: payload.daily, p_queries: payload.queries, p_pages: payload.pages,
          p_query_truncated: queries.truncated, p_page_truncated: pages.truncated,
        })
        if (error) throw dbError(`writing ${day}`, error)
        log(`${day}: ok — ${data.daily} total, ${data.queries} queries, ${data.pages} pages${final ? '' : ' (preliminary)'}` +
          (queries.truncated || pages.truncated ? ' — hit the 50,000-row cap' : ''))
      } catch (e) {
        const message = lib.sanitizedError(e)
        failed.push(`${day}: ${message}`)
        log(`${day}: FAILED — ${message}`)
        const { error } = await db.from('search_console_import_days')
          .update({ status: 'failed', last_error: message, attempted_at: now().toISOString() }).eq('day', day)
        // The day is already retryable (final = false); only the reason is lost
        if (error) failed.push(`${day}: recording the failure failed (${error.code || 'error'})`)
        // No access: every later day fails the same way
        if (e && e.gsc && (e.gsc.status === 401 || e.gsc.status === 403)) break
      }
    }

    if (toExpire.length || failed.length) {
      const lines = []
      if (failed.length) lines.push(`${failed.length} problem(s) — retried next run:\n${failed.slice(0, 10).join('\n')}`)
      if (toExpire.length) lines.push(`${toExpire.length} day(s) expired beyond Search Console's 16-month retention: ${toExpire.join(', ')}`)
      await slack(`:warning: Search Console import\n${lines.join('\n')}`)
    }
    return failed.length ? 1 : 0
  } catch (e) {
    const message = lib.sanitizedError(e)
    log(`Search Console import failed: ${message}`)
    await slack(`:x: Search Console import failed: ${message}`)
    return 1
  }
}

module.exports = { runImport, readImportDays }

if (require.main === module) {
  const { createClient } = require('@supabase/supabase-js')
  const ws = require('ws')   // Node 20 has no global WebSocket (supabase-js realtime), as in daily-sync.js
  // A startup failure is reported like any other (log + Slack), never with a secret
  const startupFailure = async message => {
    console.log(`Search Console import failed: ${message}`)
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `:x: Search Console import failed: ${message}` }) }).catch(() => {})
    }
    process.exit(1)
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    startupFailure('Supabase credentials are not set')
  } else {
    let db
    try {
      db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false }, realtime: { transport: ws } })
    } catch {
      db = null
    }
    if (!db) startupFailure('could not create the Supabase client')
    else runImport({ env: process.env, fetch: globalThis.fetch, db }).then(code => process.exit(code))
  }
}
