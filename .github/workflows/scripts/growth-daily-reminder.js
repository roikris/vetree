// Daily Slack message for the synthesis auto-run experiment (run 2) — the Campaign page's numbers.
// Same window, baseline and day counter as app/admin/campaign/page.tsx + lib/synthesis/experiment.ts
// (plain Node can't import the TypeScript; tests/unit/experiment.test.ts keeps them in step).
// Run 1 (2026-06-20 → 2026-09-28) is not comparable; this script still counted from it until
// admin-002 ("Day 117/90").

const KICKOFF_DATE = '2026-09-29'
const END_DATE = '2026-12-27'  // day 90, inclusive
const TOTAL_DAYS = 90
// The pre-experiment month (no auto-run), as the Campaign page — not "everything before kickoff"
const BASELINE_START = '2026-05-21'
const BASELINE_END = '2026-06-19'
// Snapshot metrics are rolling windows (7-day counts; 30-day MAU): until kickoff + 30 days they
// still contain days from before run 2
const WARMUP_DAYS = 30
// Excluded accounts, as lib/analytics-excluded-ids.ts: the admin, plus the smoke-test account
// (TEST_USER_ID, or found from TEST_USER_EMAIL) — its ordinary production visits are recorded like anyone's
const ADMIN_USER_ID = '90cb8294-b593-4144-a9f5-23ca52dd5e35'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The user_id .or() filter of excludedUsersOrFilter(); throws on a malformed TEST_USER_ID */
function excludedUsersOrFilter(testUserId) {
  const ids = [ADMIN_USER_ID]
  const t = (testUserId || '').trim()
  if (t) {
    if (!UUID_RE.test(t)) throw new Error(`TEST_USER_ID="${t}" is not a valid UUID`)
    ids.push(t)
  }
  const neq = ids.map(id => `user_id.neq.${id}`)
  return `user_id.is.null,${neq.length === 1 ? neq[0] : `and(${neq.join(',')})`}`
}

const DAY_MS = 24 * 60 * 60 * 1000
const utcMidnight = date => Date.parse(`${date}T00:00:00Z`)

/** The experiment day (1–90) of a YYYY-MM-DD date (UTC), clamped */
function dayNumber(date) {
  const days = Math.floor((utcMidnight(date) - utcMidnight(KICKOFF_DATE)) / DAY_MS)
  return Math.min(TOTAL_DAYS, Math.max(1, days + 1))
}

/** 'before' | 'running' | 'ended' at an instant — ended from END_DATE + 1 day 00:00 UTC */
function phase(now) {
  const t = now.getTime()
  if (t < utcMidnight(KICKOFF_DATE)) return 'before'
  if (t >= utcMidnight(END_DATE) + DAY_MS) return 'ended'
  return 'running'
}

function avg(rows, key) {
  const vals = rows.map(r => r[key]).filter(v => v != null && !isNaN(v))
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

function fmtSec(v) {
  if (!v) return '—'
  if (v < 60) return `${Math.round(v)}s`
  return `${Math.floor(v / 60)}m ${Math.round(v % 60)}s`
}

function delta(current, baseline) {
  if (!baseline || baseline === 0) return null
  return ((current - baseline) / baseline) * 100
}

function fmtDelta(pct) {
  if (pct === null) return '—'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function verdictEmoji(pct) {
  if (pct === null) return '🆕'
  if (pct >= 15) return '🟢'
  if (pct < -5) return '🔴'
  return '🟡'
}

/**
 * The Slack text. rows: snapshots from BASELINE_START on, ascending; engagedTotal: run-2 human
 * synthesis_engaged events (null when the count failed — never shown as zero); now: the send time.
 */
function buildMessage({ rows, engagedTotal, now, testUserExcluded = true }) {
  const baselineRows = rows.filter(r => r.date >= BASELINE_START && r.date <= BASELINE_END)
  const experimentRows = rows.filter(r => r.date >= KICKOFF_DATE && r.date <= END_DATE)
  const latestRow = experimentRows[experimentRows.length - 1] || null
  const state = phase(now)

  const day = dayNumber(latestRow ? latestRow.date : now.toISOString().slice(0, 10))
  const progressPct = Math.min(100, Math.round((day / TOTAL_DAYS) * 100))
  const filled = Math.round(progressPct / 10)
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)

  let msg = state === 'ended'
    ? `🏁 *Vetree Synthesis Experiment (run 2) — ended ${END_DATE}*\n`
    : state === 'before'
      ? `🧪 *Vetree Synthesis Experiment (run 2) — starts ${KICKOFF_DATE}*\n`
      : `🧪 *Vetree Synthesis Experiment (run 2) — Day ${day}/${TOTAL_DAYS}*\n`
  msg += `\`[${bar}] ${progressPct}%\`  ${KICKOFF_DATE} → ${END_DATE}\n`
  msg += `━━━━━━━━━━━━━━━\n`

  if (!latestRow) {
    msg += `_No run-2 snapshot yet — aggregate cron runs at 02:00 UTC_\n`
  } else {
    // registered_mau was 0 in snapshots before migration 025 — only average populated rows
    const baselineMedian = avg(baselineRows, 'median_session_duration_seconds')
    const baselineRegisteredMau = avg(baselineRows.filter(r => (r.registered_mau || 0) > 0), 'registered_mau')
    const baselineMau = avg(baselineRows, 'mau')
    const baselineDauMau = baselineMau > 0 ? (avg(baselineRows, 'dau') / baselineMau) * 100 : 0

    const todayMedian = latestRow.median_session_duration_seconds ?? null
    const todayRegisteredMau = latestRow.registered_mau ?? null
    const todayDauMau = (latestRow.dau && latestRow.mau && latestRow.mau > 0)
      ? (latestRow.dau / latestRow.mau) * 100
      : null

    const medianDelta = todayMedian !== null ? delta(todayMedian, baselineMedian) : null
    const mauDelta = todayRegisteredMau !== null ? delta(todayRegisteredMau, baselineRegisteredMau) : null
    const dauMauDelta = todayDauMau !== null ? delta(todayDauMau, baselineDauMau) : null

    msg += `*📊 Latest snapshot: ${latestRow.date}*\n\n`

    msg += `${verdictEmoji(medianDelta)} *Session depth:*  `
    msg += `${fmtSec(todayMedian)}  _(baseline ${fmtSec(baselineMedian)},_ ${fmtDelta(medianDelta)}_)_\n`

    msg += `${verdictEmoji(null)} *Synthesis engaged:*  `
    msg += `${engagedTotal ?? '— (count failed)'} run-2 total  _(new metric${testUserExcluded ? '' : '; test account not excluded — its id could not be found'})_\n`

    msg += `${verdictEmoji(mauDelta)} *Registered MAU:*  `
    msg += `${todayRegisteredMau ?? '—'}  _(baseline ${Math.round(baselineRegisteredMau)},_ ${fmtDelta(mauDelta)}_)_\n`

    msg += `${verdictEmoji(dauMauDelta)} *DAU/MAU:*  `
    msg += `${todayDauMau !== null ? todayDauMau.toFixed(1) + '%' : '—'}  _(baseline ${baselineDauMau.toFixed(1)}%,_ ${fmtDelta(dauMauDelta)}_)_\n`

    const warmupUntil = new Date(utcMidnight(KICKOFF_DATE) + WARMUP_DAYS * DAY_MS).toISOString().slice(0, 10)
    if (latestRow.date < warmupUntil) {
      msg += `_Session, MAU and DAU/MAU are rolling windows that still include days before kickoff until ${warmupUntil}._\n`
    }
  }

  msg += `━━━━━━━━━━━━━━━\n`
  msg += `<https://vetree.app/admin/campaign|View campaign dashboard →>`
  return { msg, day, state }
}

/**
 * The smoke-test account's id: TEST_USER_ID when set, else looked up (read-only) from
 * TEST_USER_EMAIL — GitHub has the email secret, and Vercel won't reveal the id. null if neither works.
 */
async function resolveTestUserId(supabase, env) {
  if ((env.TEST_USER_ID || '').trim()) return env.TEST_USER_ID.trim()
  const email = (env.TEST_USER_EMAIL || '').trim().toLowerCase()
  if (!email) return null
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) { console.error('test account lookup failed:', error.message); return null }
    const hit = data.users.find(u => (u.email || '').toLowerCase() === email)
    if (hit) return hit.id
    if (data.users.length < 1000) break
  }
  console.error('test account lookup: no user with TEST_USER_EMAIL')
  return null
}

async function sendDailyReminder() {
  const { createClient } = require('@supabase/supabase-js')
  const ws = require('ws')
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!supabaseUrl || !supabaseKey || !slackWebhookUrl) {
    console.error('Missing required environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: { transport: ws },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data: rows, error } = await supabase
      .from('analytics_daily_snapshot')
      .select('date, dau, mau, registered_mau, median_session_duration_seconds')
      .gte('date', BASELINE_START)
      .order('date', { ascending: true })

    if (error) throw new Error(`Supabase error: ${error.message}`)

    const testUserId = await resolveTestUserId(supabase, process.env)

    // Run-2 human engagement from raw events, as lib/analytics/synthesisEvents.ts counts it
    const { count, error: countError } = await supabase.from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', 'synthesis_engaged')
      .is('bot_name', null)
      .is('traffic_class', null)
      .or(excludedUsersOrFilter(testUserId))
      .gte('created_at', `${KICKOFF_DATE}T00:00:00Z`)
      .lt('created_at', new Date(utcMidnight(END_DATE) + DAY_MS).toISOString())
    if (countError) console.error('synthesis_engaged count failed:', countError.message)

    const { msg, day, state } = buildMessage({
      rows: rows || [],
      engagedTotal: countError ? null : (count ?? 0),
      now: new Date(),
      testUserExcluded: Boolean(testUserId),
    })

    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: msg, mrkdwn: true }),
    })

    if (!response.ok) throw new Error(`Slack webhook failed: ${response.statusText}`)

    console.log(`✅ Reminder sent — ${state === 'running' ? `Day ${day}/${TOTAL_DAYS}` : state}`)
    if (countError) process.exit(1)  // sent, but the run is red: the engaged count failed
  } catch (err) {
    console.error('❌ Error sending daily reminder:', err)
    process.exit(1)
  }
}

module.exports = { KICKOFF_DATE, END_DATE, TOTAL_DAYS, BASELINE_START, BASELINE_END, dayNumber, phase, buildMessage, excludedUsersOrFilter, resolveTestUserId }

if (require.main === module) sendDailyReminder()
