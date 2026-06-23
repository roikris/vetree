const { createClient } = require('@supabase/supabase-js')
const ws = require('ws')

const KICKOFF_DATE = '2026-06-20'
const END_DATE = '2026-09-18'
const BASELINE_START = '2026-05-21'
const TOTAL_DAYS = 90

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

async function sendDailyReminder() {
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
    const today = new Date().toISOString().split('T')[0]

    // Fetch baseline + experiment snapshots
    const { data: rows, error } = await supabase
      .from('analytics_daily_snapshot')
      .select('date, dau, mau, registered_mau, total_searches, synthesis_runs, synthesis_engaged, median_session_duration_seconds')
      .gte('date', BASELINE_START)
      .order('date', { ascending: true })

    if (error) throw new Error(`Supabase error: ${error.message}`)

    const allRows = rows || []
    const baselineRows = allRows.filter(r => r.date < KICKOFF_DATE)
    const experimentRows = allRows.filter(r => r.date >= KICKOFF_DATE)
    const latestRow = experimentRows[experimentRows.length - 1] || null

    // Baseline averages
    // registered_mau was 0 in snapshots before migration 025 — only average populated rows
    const baselineMedian = avg(baselineRows, 'median_session_duration_seconds')
    const baselineRegisteredMau = avg(baselineRows.filter(r => (r.registered_mau || 0) > 0), 'registered_mau')
    const baselineDau = avg(baselineRows, 'dau')
    const baselineMau = avg(baselineRows, 'mau')
    const baselineDauMau = baselineMau > 0 ? (baselineDau / baselineMau) * 100 : 0

    // Day number
    const kickoff = new Date(KICKOFF_DATE)
    const nowDate = latestRow ? new Date(latestRow.date) : new Date()
    const dayNumber = Math.max(1, Math.floor((nowDate - kickoff) / (1000 * 60 * 60 * 24)) + 1)
    const progressPct = Math.min(100, Math.round((dayNumber / TOTAL_DAYS) * 100))

    // Progress bar (10 chars)
    const filled = Math.round(progressPct / 10)
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)

    // Today's metrics
    const todayMedian = latestRow?.median_session_duration_seconds ?? null
    const todayEngaged = latestRow?.synthesis_engaged ?? null
    const todayRegisteredMau = latestRow?.registered_mau ?? null
    const todayDauMau = (latestRow?.dau && latestRow?.mau && latestRow.mau > 0)
      ? (latestRow.dau / latestRow.mau) * 100
      : null

    const medianDelta = todayMedian !== null ? delta(todayMedian, baselineMedian) : null
    const mauDelta = todayRegisteredMau !== null ? delta(todayRegisteredMau, baselineRegisteredMau) : null
    const dauMauDelta = todayDauMau !== null ? delta(todayDauMau, baselineDauMau) : null

    // Build message
    let msg = `🧪 *Vetree Synthesis Experiment — Day ${dayNumber}/${TOTAL_DAYS}*\n`
    msg += `\`[${bar}] ${progressPct}%\`  ${KICKOFF_DATE} → ${END_DATE}\n`
    msg += `━━━━━━━━━━━━━━━\n`

    if (!latestRow) {
      msg += `_No snapshot data yet — aggregate cron runs at 02:00 UTC_\n`
    } else {
      msg += `*📊 Latest snapshot: ${latestRow.date}*\n\n`

      msg += `${verdictEmoji(medianDelta)} *Session depth:*  `
      msg += `${fmtSec(todayMedian)}  _(baseline ${fmtSec(baselineMedian)},_ ${fmtDelta(medianDelta)}_)_\n`

      msg += `${verdictEmoji(null)} *Synthesis engaged:*  `
      msg += `${todayEngaged ?? '—'}/day  _(new metric)_\n`

      msg += `${verdictEmoji(mauDelta)} *Registered MAU:*  `
      msg += `${todayRegisteredMau ?? '—'}  _(baseline ${Math.round(baselineRegisteredMau)},_ ${fmtDelta(mauDelta)}_)_\n`

      msg += `${verdictEmoji(dauMauDelta)} *DAU/MAU:*  `
      msg += `${todayDauMau !== null ? todayDauMau.toFixed(1) + '%' : '—'}  _(baseline ${baselineDauMau.toFixed(1)}%,_ ${fmtDelta(dauMauDelta)}_)_\n`
    }

    msg += `━━━━━━━━━━━━━━━\n`
    msg += `<https://vetree.app/admin/campaign|View campaign dashboard →>`

    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: msg, mrkdwn: true }),
    })

    if (!response.ok) throw new Error(`Slack webhook failed: ${response.statusText}`)

    console.log(`✅ Reminder sent — Day ${dayNumber}/${TOTAL_DAYS}`)
    if (latestRow) {
      console.log(`  session: ${fmtSec(todayMedian)} (baseline ${fmtSec(baselineMedian)})`)
      console.log(`  synthesis_engaged: ${todayEngaged}`)
      console.log(`  registered_mau: ${todayRegisteredMau}`)
    }

  } catch (err) {
    console.error('❌ Error sending daily reminder:', err)
    process.exit(1)
  }
}

sendDailyReminder()
