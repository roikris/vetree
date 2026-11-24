// The December trial's analysis (growth-005) — pure maths over rows the results route reads; tested offline in
// tests/unit/trialAnalysis.test.ts. Design reviewed by Codex (3 plan rounds). What it can and cannot say:
// - The two randomised splits (LinkedIn link placement, WhatsApp format) are the only treatment comparisons.
// - December vs the Oct 13 – Nov 30 baseline, Facebook (unchanged) and December 2025 are DESCRIPTIVE context: the
//   LinkedIn prompt bundle and the WhatsApp cadence change are before/after, not controlled.
// - "Drivers" are patterns over article-days, not causes.
// Definitions:
// - arrival = the first page view of a session that carries an organic social UTM (utm_medium 'social') or a Google
//   referrer. Later pages of the visit keep the stored UTM, so only the first counts.
// - a post's outcome = arrivals credited to it within FOLLOW_UP_DAYS of being marked posted; posts with none count as 0;
//   a post younger than that is "maturing" and left out of comparisons.
// - December arrivals map to one trial post by utm_source + utm_campaign token; Facebook IL (link-free, via
//   vetree.app/il) and the baseline map by channel + article to the most recent earlier post (several eligible →
//   "ambiguous" tally).

import { israelDate } from './daily'
import { BASELINE_END, BASELINE_START, FOLLOW_UP_DAYS, TRIAL_END, TRIAL_START, parseTrialCampaign } from './trial'
import { articleIdFromPath, isGoogleReferrer } from '@/lib/analytics/searchConsole'
import { daySource } from './pickSource'

export const CHANNELS = ['whatsapp', 'telegram', 'linkedin', 'facebook_il', 'facebook_intl'] as const
export type Channel = (typeof CHANNELS)[number]
export type Source = Channel | 'google'

export type ApprovalIn = { id: string; article_id: string; platform: string; created_at: string }
export type TrialRowIn = {
  approval_id: string; platform: string; trial_date: string; variant: string | null; utm_campaign: string | null
  char_count: number | null; ends_with_question: boolean | null
  li_comments: number | null; li_comments_age_hours: number | null
  li_impressions: number | null; li_impressions_age_hours: number | null
  /** growth-006 (091): how the day's article was chosen; NULL = not recorded */
  pick_source?: string | null
}
export type ViewIn = {
  created_at: string; path: string; session_id: string | null; ip_hash: string | null; user_id: string | null
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; referrer: string | null
  duration_seconds: number | null
}
export type EventIn = { event_name: string; created_at: string; ip_hash: string | null; user_id: string | null }
export type SignupIn = { id: string; created_at: string }
export type ScoreIn = { practice: number; talk: number; wow: number }
export type DailyLinkedinIn = { metric_date: string; impressions: number | null }

export type AnalysisInput = {
  now: Date
  approvals: ApprovalIn[]
  trialRows: TrialRowIn[]
  views: ViewIn[]
  events: EventIn[]
  signups: SignupIn[]
  scores: Map<string, ScoreIn>
  labels: Map<string, string[]>
  linkedinDaily: DailyLinkedinIn[]
}

const DAY = 24 * 3600 * 1000
const t = (iso: string) => Date.parse(iso)
const inRange = (date: string, from: string, to: string) => date >= from && date <= to
export const periodOf = (date: string): 'baseline' | 'trial' | null =>
  inRange(date, BASELINE_START, BASELINE_END) ? 'baseline' : inRange(date, TRIAL_START, TRIAL_END) ? 'trial' : null

/** The channel a view's UTM names (organic only), or null. Facebook IL / Intl are told apart by utm_campaign. */
export function channelOf(v: Pick<ViewIn, 'utm_source' | 'utm_medium' | 'utm_campaign'>): Channel | null {
  if (v.utm_medium !== 'social') return null
  const src = (v.utm_source ?? '').toLowerCase()
  if (src === 'whatsapp' || src === 'telegram' || src === 'linkedin') return src
  if (src === 'facebook') {
    const c = (v.utm_campaign ?? '').toLowerCase()
    if (c === 'il') return 'facebook_il'
    if (c === 'intl' || c.startsWith('intl-trial-')) return 'facebook_intl'
  }
  return null
}

export type Arrival = { at: number; date: string; source: Source; article: string | null; campaign: string | null; engaged: boolean; ip_hash: string | null; user_id: string | null }

/** First view per session with a social channel or a Google referrer (sessions without an id: each view counts). */
export function arrivalsOf(views: ViewIn[]): Arrival[] {
  const sorted = [...views].sort((a, b) => t(a.created_at) - t(b.created_at))
  const seen = new Set<string>()
  const out: Arrival[] = []
  for (const v of sorted) {
    const ch = channelOf(v)
    const source: Source | null = ch ?? (isGoogleReferrer(v.referrer) ? 'google' : null)
    if (!source) continue
    // a new tagged link in the same tab is a new arrival (its campaign differs); later pages repeat the stored set
    const key = v.session_id ? `${v.session_id}|${source}|${v.utm_campaign ?? ''}` : null
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    out.push({
      at: t(v.created_at), date: israelDate(v.created_at), source, article: articleIdFromPath(v.path.split('?')[0]),
      campaign: v.utm_campaign, engaged: (v.duration_seconds ?? 0) >= 30, ip_hash: v.ip_hash, user_id: v.user_id,
    })
  }
  return out
}

export type PostOutcome = {
  approval_id: string; channel: Channel; article_id: string; date: string; period: 'baseline' | 'trial'
  trial: boolean; variant: string | null; mature: boolean; visits: number; engaged: number
  char_count: number | null; ends_with_question: boolean | null; li_comments: number | null; li_impressions: number | null
  li_comments_age_hours: number | null; li_impressions_age_hours: number | null
}

/** Credit every arrival to at most one post. */
export function postOutcomes(input: Pick<AnalysisInput, 'now' | 'approvals' | 'trialRows'>, arrivals: Arrival[]) {
  const trialBy = new Map(input.trialRows.map(r => [r.approval_id, r]))
  const posts: PostOutcome[] = []
  for (const a of input.approvals) {
    if (!(CHANNELS as readonly string[]).includes(a.platform)) continue
    const date = israelDate(a.created_at)
    const period = periodOf(date)
    if (!period) continue
    const tr = trialBy.get(a.id)
    posts.push({
      approval_id: a.id, channel: a.platform as Channel, article_id: a.article_id, date, period, trial: !!tr,
      variant: tr?.variant ?? null, mature: t(a.created_at) + FOLLOW_UP_DAYS * DAY <= input.now.getTime(),
      visits: 0, engaged: 0, char_count: tr?.char_count ?? null, ends_with_question: tr?.ends_with_question ?? null,
      li_comments: tr?.li_comments ?? null, li_impressions: tr?.li_impressions ?? null,
      li_comments_age_hours: tr?.li_comments_age_hours ?? null, li_impressions_age_hours: tr?.li_impressions_age_hours ?? null,
    })
  }
  const createdAt = new Map(input.approvals.map(a => [a.id, t(a.created_at)]))
  const byTrialToken = new Map<string, PostOutcome>()
  for (const p of posts) if (p.trial && p.channel !== 'facebook_il') byTrialToken.set(`${p.channel}|${p.date}`, p)
  let ambiguous = 0
  let unmatched = 0
  for (const ar of arrivals) {
    if (ar.source === 'google') continue
    let target: PostOutcome | undefined
    const token = parseTrialCampaign(ar.campaign)
    if (token) {
      target = byTrialToken.get(`${ar.source}|${token.date}`)
    } else {
      const eligible = posts.filter(p => p.channel === ar.source && p.article_id === ar.article
        && createdAt.get(p.approval_id)! <= ar.at && ar.at < createdAt.get(p.approval_id)! + FOLLOW_UP_DAYS * DAY
        // a trial post with a token is reached through its token, not by article (except Facebook IL)
        && !(p.trial && p.channel !== 'facebook_il'))
      if (eligible.length > 1) ambiguous++
      target = eligible.sort((x, y) => createdAt.get(y.approval_id)! - createdAt.get(x.approval_id)!)[0]
    }
    // both bounds, for token matches too (a preview link opened before the post was marked never counts)
    const postedAt = target ? createdAt.get(target.approval_id)! : 0
    if (target && ar.at >= postedAt && ar.at < postedAt + FOLLOW_UP_DAYS * DAY) {
      target.visits++
      if (ar.engaged) target.engaged++
    } else unmatched++
  }
  return { posts, ambiguous, unmatched }
}

// ─── Signups (approximate, labelled) ────────────────────────────────────────────────────────────────────────────
export type SignupAttribution = { id: string; date: string; source: Source | 'unattributed'; ambiguous: boolean; arrivalDate: string | null }

export function attributeSignups(signups: SignupIn[], views: ViewIn[], arrivals: Arrival[]): SignupAttribution[] {
  return signups.map(s => {
    const at = t(s.created_at)
    const ips = new Set(views.filter(v => v.user_id === s.id && v.ip_hash && t(v.created_at) >= at && t(v.created_at) < at + DAY).map(v => v.ip_hash!))
    const candidates = arrivals.filter(a => a.at <= at && a.at >= at - DAY && (a.user_id === s.id || (a.ip_hash && ips.has(a.ip_hash))))
      .sort((x, y) => x.at - y.at)
    const sources = new Set(candidates.map(c => c.source))
    const first = candidates[0]
    return { id: s.id, date: israelDate(s.created_at), source: first?.source ?? 'unattributed', ambiguous: sources.size > 1, arrivalDate: first?.date ?? null }
  })
}

// ─── Statistics ─────────────────────────────────────────────────────────────────────────────────────────────────
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN)
const israelWeek = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d))
  return new Date(day.getTime() - day.getUTCDay() * DAY).toISOString().slice(0, 10)
}

export type SplitResult = {
  arms: { name: string; n: number; mean: number; values: number[] }[]
  diff: number; ratio: number | null; ci90: [number, number] | null; p: number | null
  verdict: 'too_few' | 'no_clear_difference' | 'difference'
}
export const MIN_ARM = 8

/**
 * Two arms of (date, value): difference of means B − A, a bootstrap 90% interval (resampling within each arm) and a
 * permutation p-value that reshuffles labels within each Israel week — the blocks the assignment was balanced in.
 */
export function compareArms(a: { name: string; obs: { date: string; value: number }[] }, b: { name: string; obs: { date: string; value: number }[] }, seed = 1): SplitResult {
  const va = a.obs.map(o => o.value)
  const vb = b.obs.map(o => o.value)
  const arms = [{ name: a.name, n: va.length, mean: mean(va), values: va }, { name: b.name, n: vb.length, mean: mean(vb), values: vb }]
  const diff = mean(vb) - mean(va)
  const ratio = mean(va) > 0 ? mean(vb) / mean(va) : null
  if (va.length < MIN_ARM || vb.length < MIN_ARM) return { arms, diff, ratio, ci90: null, p: null, verdict: 'too_few' }
  const r = rng(seed)
  const pick = (xs: number[]) => xs[Math.floor(r() * xs.length)]
  const boots: number[] = []
  for (let i = 0; i < 4000; i++) {
    boots.push(mean(vb.map(() => pick(vb))) - mean(va.map(() => pick(va))))
  }
  boots.sort((x, y) => x - y)
  const ci90: [number, number] = [boots[Math.floor(0.05 * boots.length)], boots[Math.floor(0.95 * boots.length) - 1]]
  // within-week permutation
  const all = [...a.obs.map(o => ({ ...o, arm: 0 })), ...b.obs.map(o => ({ ...o, arm: 1 }))]
  const blocks = new Map<string, typeof all>()
  for (const o of all) { const k = israelWeek(o.date); blocks.set(k, [...(blocks.get(k) ?? []), o]) }
  let extreme = 0
  const N = 4000
  for (let i = 0; i < N; i++) {
    const sa: number[] = []
    const sb: number[] = []
    for (const block of blocks.values()) {
      const labels = block.map(o => o.arm)
      for (let j = labels.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [labels[j], labels[k]] = [labels[k], labels[j]] }
      block.forEach((o, j) => (labels[j] ? sb : sa).push(o.value))
    }
    if (Math.abs(mean(sb) - mean(sa)) >= Math.abs(diff) - 1e-12) extreme++
  }
  const p = (extreme + 1) / (N + 1)
  const verdict = ci90[0] > 0 || ci90[1] < 0 ? 'difference' : 'no_clear_difference'
  return { arms, diff, ratio, ci90, p, verdict }
}

// ─── The report ─────────────────────────────────────────────────────────────────────────────────────────────────
export type ChannelRow = {
  channel: Channel; period: 'baseline' | 'trial'; posts: number; mature: number; visits: number; meanVisits: number
  shareWithVisit: number; engagedShare: number | null; arrivals: number; signups: number; signupsPer100: number | null
}
export type DriverRow = { factor: string; bucket: string; articleDays: number; meanVisits: number; shareWithVisit: number; greyed: boolean }

export function analyzeTrial(input: AnalysisInput) {
  const arrivals = arrivalsOf(input.views)
  const { posts, ambiguous, unmatched } = postOutcomes(input, arrivals)
  const signups = attributeSignups(input.signups, input.views, arrivals)
  const outsideTrial = posts.filter(p => p.period === 'trial' && !p.trial).length

  // 1. scorecard — mature posts only; in December only trial posts
  const counted = (p: PostOutcome) => p.mature && (p.period === 'baseline' || p.trial)
  const scorecard: ChannelRow[] = []
  for (const period of ['baseline', 'trial'] as const) {
    for (const channel of CHANNELS) {
      const ps = posts.filter(p => p.channel === channel && p.period === period && (period === 'baseline' || p.trial))
      const mature = ps.filter(counted)
      const visits = mature.reduce((s, p) => s + p.visits, 0)
      const engaged = mature.reduce((s, p) => s + p.engaged, 0)
      const arr = arrivals.filter(a => a.source === channel && periodOf(a.date) === period).length
      // conversions belong to the arrival's period (a Dec 31 arrival signing up on Jan 1 counts for December)
      const su = signups.filter(s => s.source === channel && s.arrivalDate && periodOf(s.arrivalDate) === period).length
      scorecard.push({
        channel, period, posts: ps.length, mature: mature.length, visits, meanVisits: mature.length ? visits / mature.length : NaN,
        shareWithVisit: mature.length ? mature.filter(p => p.visits > 0).length / mature.length : NaN,
        engagedShare: visits ? engaged / visits : null, arrivals: arr, signups: su, signupsPer100: arr ? (100 * su) / arr : null,
      })
    }
  }
  const google = (['baseline', 'trial'] as const).map(period => {
    const arr = arrivals.filter(a => a.source === 'google' && periodOf(a.date) === period).length
    const su = signups.filter(s => s.source === 'google' && s.arrivalDate && periodOf(s.arrivalDate) === period).length
    return { period, arrivals: arr, signups: su, signupsPer100: arr ? (100 * su) / arr : null }
  })

  // 2. the randomised splits (December trial posts, mature)
  const trialMature = posts.filter(p => p.trial && p.mature)
  const li = trialMature.filter(p => p.channel === 'linkedin')
  const liArm = (v: string, f: (p: PostOutcome) => number | null) => ({ name: v, obs: li.filter(p => p.variant === v && f(p) !== null).map(p => ({ date: p.date, value: f(p)! })) })
  // WhatsApp + Telegram as a pair: one observation per day = the two posts' visits together
  const waDays = new Map<string, { variant: string | null; value: number }>()
  for (const p of trialMature.filter(p => p.channel === 'whatsapp' || p.channel === 'telegram')) {
    const d = waDays.get(p.date) ?? { variant: p.variant, value: 0 }
    d.value += p.visits
    waDays.set(p.date, d)
  }
  const waArm = (v: string) => ({ name: v, obs: [...waDays].filter(([, d]) => d.variant === v).map(([date, d]) => ({ date, value: d.value })) })
  const splits = {
    linkedin_comments: compareArms(liArm('in_post', p => p.li_comments), liArm('first_comment', p => p.li_comments), 11),
    linkedin_impressions: compareArms(liArm('in_post', p => p.li_impressions), liArm('first_comment', p => p.li_impressions), 12),
    linkedin_visits: compareArms(liArm('in_post', p => p.visits), liArm('first_comment', p => p.visits), 13),
    whatsapp_visits: compareArms(waArm('current'), waArm('short'), 14),
  }

  // 3. drivers — one observation per article-day (baseline + December trial posts, mature)
  const days = new Map<string, { date: string; article: string; visits: number; byChannel: Record<string, number>; firstAt: number; text: PostOutcome[] }>()
  const createdAt = new Map(input.approvals.map(a => [a.id, t(a.created_at)]))
  for (const p of posts.filter(counted)) {
    const k = `${p.date}|${p.article_id}`
    const d = days.get(k) ?? { date: p.date, article: p.article_id, visits: 0, byChannel: {}, firstAt: Infinity, text: [] }
    d.visits += p.visits
    d.byChannel[p.channel] = (d.byChannel[p.channel] ?? 0) + p.visits
    d.firstAt = Math.min(d.firstAt, createdAt.get(p.approval_id)!)
    if (p.trial && p.char_count !== null) d.text.push(p)
    days.set(k, d)
  }
  const dayList = [...days.values()]
  const labelCount = new Map<string, number>()
  for (const d of dayList) for (const l of input.labels.get(d.article) ?? []) if (!['Small Animal', 'Large Animal'].includes(l)) labelCount.set(l, (labelCount.get(l) ?? 0) + 1)
  const topLabels = [...labelCount].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l]) => l)
  const hourOf = (ms: number) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour: 'numeric', hourCycle: 'h23' }).format(ms))
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const factors: { factor: string; of: (d: (typeof dayList)[number]) => string | null }[] = [
    { factor: 'Period', of: d => (periodOf(d.date) === 'trial' ? 'December trial' : 'Baseline Oct 13 – Nov 30') },
    ...(['practice', 'talk', 'wow'] as const).map(dim => ({ factor: `Score: ${dim}`, of: (d: (typeof dayList)[number]) => {
      const s = input.scores.get(d.article)
      return s ? (s[dim] >= 8 ? '≥ 8' : '< 8') : 'not scored'
    } })),
    { factor: 'Israel weekday', of: d => { const [y, m, dd] = d.date.split('-').map(Number); return WEEKDAYS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()] } },
    { factor: 'First post time (Israel)', of: d => { const h = hourOf(d.firstAt); return h < 12 ? 'before 12:00' : h < 17 ? '12:00–17:00' : 'after 17:00' } },
    ...topLabels.map(l => ({ factor: `Label: ${l}`, of: (d: (typeof dayList)[number]) => ((input.labels.get(d.article) ?? []).includes(l) ? 'has it' : 'not') })),
  ]
  const drivers: DriverRow[] = []
  for (const f of factors) {
    const buckets = new Map<string, typeof dayList>()
    for (const d of dayList) { const b = f.of(d); if (b !== null) buckets.set(b, [...(buckets.get(b) ?? []), d]) }
    for (const [bucket, ds] of buckets) {
      drivers.push({ factor: f.factor, bucket, articleDays: ds.length, meanVisits: mean(ds.map(d => d.visits)),
        shareWithVisit: ds.filter(d => d.visits > 0).length / ds.length, greyed: ds.length < 10 })
    }
  }
  // text features: trial LinkedIn / WhatsApp posts only (baseline stored no full text)
  const textPosts = posts.filter(p => p.trial && p.mature && (p.channel === 'linkedin' || p.channel === 'whatsapp') && p.char_count !== null)
  const textDrivers: (DriverRow & { channel: string })[] = []
  for (const channel of ['linkedin', 'whatsapp']) {
    const ps = textPosts.filter(p => p.channel === channel)
    const lens = ps.map(p => p.char_count!).sort((a, b) => a - b)
    const cut1 = lens[Math.floor(lens.length / 3)] ?? 0
    const cut2 = lens[Math.floor((2 * lens.length) / 3)] ?? 0
    const groups: [string, string, PostOutcome[]][] = [
      ['Length', `short (< ${cut1})`, ps.filter(p => p.char_count! < cut1)],
      ['Length', `middle`, ps.filter(p => p.char_count! >= cut1 && p.char_count! < cut2)],
      ['Length', `long (≥ ${cut2})`, ps.filter(p => p.char_count! >= cut2)],
      ['Ends with a question', 'yes', ps.filter(p => p.ends_with_question)],
      ['Ends with a question', 'no', ps.filter(p => p.ends_with_question === false)],
    ]
    for (const [factor, bucket, g] of groups) {
      if (!g.length) continue
      textDrivers.push({ channel, factor, bucket, articleDays: g.length, meanVisits: mean(g.map(p => p.visits)),
        shareWithVisit: g.filter(p => p.visits > 0).length / g.length, greyed: g.length < 10 })
    }
  }

  // 4. funnel — December arrivals by source: arrival → wall shown → signup page → attributed signup (24 h, same ip)
  const funnel = ([...CHANNELS, 'google'] as Source[]).map(source => {
    const arr = arrivals.filter(a => a.source === source && periodOf(a.date) === 'trial')
    const within = (name: string) => arr.filter(a => input.events.some(e => e.event_name === name && e.ip_hash && e.ip_hash === a.ip_hash
      && t(e.created_at) >= a.at && t(e.created_at) < a.at + DAY)).length
    return {
      source, arrivals: arr.length, wallShown: within('wall_shown'), signupViewed: within('signup_step_viewed'),
      signups: signups.filter(s => s.source === source && s.arrivalDate && periodOf(s.arrivalDate) === 'trial').length,
    }
  })

  // 5. LinkedIn weekly totals (descriptive): mean impressions per day
  const liDaily = (from: string, to: string) => {
    const rows = input.linkedinDaily.filter(r => r.metric_date >= from && r.metric_date <= to && r.impressions !== null)
    return { days: rows.length, perDay: rows.length ? rows.reduce((s, r) => s + (r.impressions ?? 0), 0) / rows.length : null }
  }
  const linkedinTotals = {
    baseline: liDaily(BASELINE_START, BASELINE_END),
    trial: liDaily(TRIAL_START, TRIAL_END),
    december2025: liDaily('2025-12-01', '2025-12-31'),
    latestDate: input.linkedinDaily.reduce<string | null>((m, r) => (!m || r.metric_date > m ? r.metric_date : m), null),
  }

  const maturing = posts.filter(p => p.trial && !p.mature).length
  const signupSummary = {
    total: signups.length,
    ambiguous: signups.filter(s => s.ambiguous).length,
    unattributed: signups.filter(s => s.source === 'unattributed').length,
  }
  // 6. how each trial day's article was chosen (growth-006) — descriptive; the scores are in the drivers above, and
  // January joins growth_recommendation_sets (lists shown that Israel day before the first post) for positions
  const approvalById = new Map(input.approvals.map(a => [a.id, a]))
  const rowsByDay = new Map<string, { created_at: string; approval_id: string; pick_source: string | null; article_id: string | null }[]>()
  for (const r of input.trialRows) {
    const a = approvalById.get(r.approval_id)
    const list = rowsByDay.get(r.trial_date) ?? []
    list.push({ created_at: a?.created_at ?? '', approval_id: r.approval_id, pick_source: r.pick_source ?? null, article_id: a?.article_id ?? null })
    rowsByDay.set(r.trial_date, list)
  }
  const picks = [...rowsByDay.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([date, rows]) => {
    const first = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.approval_id.localeCompare(b.approval_id))[0]
    const { source, disagree } = daySource(rows)
    return { date, article_id: first?.article_id ?? null, pick_source: source ?? 'not recorded', disagree, posts: rows.length }
  })

  return { scorecard, google, splits, drivers, textDrivers, funnel, linkedinTotals, attribution: { ambiguous, unmatched, outsideTrial, maturing }, signupSummary, picks, posts }
}
export type TrialAnalysis = ReturnType<typeof analyzeTrial>
