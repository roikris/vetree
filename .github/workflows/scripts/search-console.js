// Daily Google Search Console import (analytics-001, migration 088). Run by .github/workflows/search-console.yml.
// Reads sc-domain:vetree.app with a read-only service account (GSC_SERVICE_ACCOUNT_JSON) and writes one Pacific day
// at a time through replace_search_console_day(). Days that fail are recorded as 'failed' and retried by every later
// run until they are imported and final; see selectDays() in search-console-lib.js.
// Never prints the key, a token or a response body: errors carry an HTTP status and Google's error reason only.
const { createClient } = require('@supabase/supabase-js')
const ws = require('ws')   // Node 20 has no global WebSocket (supabase-js realtime), as in daily-sync.js
const lib = require('./search-console-lib')

const mask = value => { for (const line of String(value).split('\n')) if (line.trim()) console.log(`::add-mask::${line.trim()}`) }
const safe = message => Object.assign(new Error(message), { safe: true })

async function accessToken(account) {
  const jwt = lib.buildJwt(account, Math.floor(Date.now() / 1000))
  mask(jwt)
  const res = await fetch(lib.TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: lib.GRANT_TYPE, assertion: jwt }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body || typeof body.access_token !== 'string') {
    const err = new Error('token'); err.gsc = { what: 'token exchange', status: res.status, reason: body && typeof body.error === 'string' ? body.error : undefined }
    throw err
  }
  mask(body.access_token)
  return body.access_token
}

async function query(token, day, dimension) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(lib.SITE)}/searchAnalytics/query`
  const what = `query ${day} ${dimension || 'totals'}`
  return lib.fetchAllRows(async startRow => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(lib.requestBody(day, dimension, startRow)),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) throw lib.googleError(what, res.status, body)
    if (!body || typeof body !== 'object') throw safe(`${what}: unreadable response`)
    return body
  })
}

async function slack(text) {
  if (!process.env.SLACK_WEBHOOK_URL) return
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
  }).catch(() => { /* best effort */ })
}

async function main() {
  const lookback = lib.parseLookback(process.env.GSC_DAYS)
  if (!process.env.GSC_SERVICE_ACCOUNT_JSON) throw safe('GSC_SERVICE_ACCOUNT_JSON is not set')
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw safe('Supabase credentials are not set')
  const account = lib.parseServiceAccount(process.env.GSC_SERVICE_ACCOUNT_JSON)
  mask(account.privateKey)

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, realtime: { transport: ws } })
  const { data: importDays, error: readError } = await db.from('search_console_import_days')
    .select('day, status, final').order('day')
  if (readError) throw safe(`reading search_console_import_days failed (${readError.code || 'error'})`)

  const todayPt = lib.pacificDate(new Date())
  const { toImport, toExpire, horizon } = lib.selectDays({ todayPt, lookback, importDays })
  console.log(`Pacific today ${todayPt}; lookback ${lookback}; importing ${toImport.length} day(s)` +
    (toImport.length ? ` ${toImport[0]} … ${toImport[toImport.length - 1]}` : '') + `; retention horizon ${horizon}`)

  // Days older than Google's retention can never be imported: record that once
  if (toExpire.length) {
    const { error } = await db.from('search_console_import_days')
      .update({ status: 'expired', last_error: 'beyond Search Console retention', attempted_at: new Date().toISOString() })
      .in('day', toExpire)
    if (error) throw safe(`marking expired days failed (${error.code || 'error'})`)
  }

  // Every day of this run gets a durable record first, so a crash leaves a pending set the next run repairs
  const pending = toImport.filter(d => !importDays.some(r => r.day === d))
    .map(day => ({ day, status: 'failed', final: false, last_error: 'not attempted yet' }))
  if (pending.length) {
    const { error } = await db.from('search_console_import_days').upsert(pending, { onConflict: 'day', ignoreDuplicates: true })
    if (error) throw safe(`recording pending days failed (${error.code || 'error'})`)
  }

  const token = toImport.length ? await accessToken(account) : null
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
      if (error) throw safe(`writing ${day} failed (${error.code || 'error'})`)
      console.log(`${day}: ok — ${data.daily} total, ${data.queries} queries, ${data.pages} pages${final ? '' : ' (preliminary)'}` +
        (queries.truncated || pages.truncated ? ' — hit the 50,000-row cap' : ''))
    } catch (e) {
      const message = lib.sanitizedError(e)
      failed.push(`${day}: ${message}`)
      console.log(`${day}: FAILED — ${message}`)
      await db.from('search_console_import_days')
        .update({ status: 'failed', last_error: message, attempted_at: new Date().toISOString() })
        .eq('day', day)
      // No access: every later day fails the same way
      if (e && e.gsc && (e.gsc.status === 401 || e.gsc.status === 403)) break
    }
  }

  if (toExpire.length || failed.length) {
    const lines = []
    if (failed.length) lines.push(`${failed.length} day(s) failed (retried next run):\n${failed.slice(0, 10).join('\n')}`)
    if (toExpire.length) lines.push(`${toExpire.length} day(s) expired beyond Search Console's 16-month retention: ${toExpire.join(', ')}`)
    await slack(`:warning: Search Console import\n${lines.join('\n')}`)
  }
  if (failed.length) process.exit(1)
}

main().catch(async e => {
  const message = lib.sanitizedError(e)
  console.log(`Search Console import failed: ${message}`)
  await slack(`:x: Search Console import failed: ${message}`)
  process.exit(1)
})
