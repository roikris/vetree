// The December 2026 posting trial (growth-005, Roi 2026-11-23): for all of December Roi posts from Growth OS →
// 🧪 December Trial instead of Daily Posts (which stays as it is). Pure rules, no React / Supabase — tested offline in
// tests/unit/trial.test.ts. Plan reviewed by Codex in 3 rounds (BLOCKING: none).
//
// What the trial changes, per channel:
// - LinkedIn: still daily (standing constraint: never change LinkedIn cadence); a new format with Roi's own take and a
//   closing question; randomised per day: the article link in the post vs in the first comment.
// - WhatsApp (+ Telegram, which copies it): Sun / Mon / Tue / Thu only; randomised per WhatsApp day: short format vs
//   the current one.
// - Facebook IL / International: unchanged (descriptive context only — never a "seasonal adjustment").
// - X: not posted.
// The variant table below was generated once (seed 20261201) so each Israel week splits as evenly as possible between
// the arms, and committed as literal data: the assignment is fixed in advance, never chosen on the day. Migration 089's
// trial_variant() holds the same table; tests/unit/trial.test.ts keeps the two equal.

import { israelDate, israelDateMinus, type PostingPlatform } from './daily'

export const TRIAL_START = '2026-12-01'
export const TRIAL_END = '2026-12-31' // inclusive, Israel dates
export const TRIAL_DAYS = 31
/** Every December post has had its full 7-day follow-up from this Israel date: results are final from then. */
export const TRIAL_FINAL_DATE = '2027-01-08'
/** The before/after comparison: platform labels are reliable from 10-13 (growth-002), bot tagging from 10-17. */
export const BASELINE_START = '2026-10-13'
export const BASELINE_END = '2026-11-30'
/** A post's outcome = organic visits within this long after it was marked posted. */
export const FOLLOW_UP_DAYS = 7

export type LinkedinVariant = 'in_post' | 'first_comment'
export type WhatsappVariant = 'short' | 'current'
export type DayAssignment = { linkedin: LinkedinVariant; whatsapp?: WhatsappVariant }

export const TRIAL_SCHEDULE: Record<string, DayAssignment> = {
  '2026-12-01': { linkedin: 'in_post', whatsapp: 'short' },
  '2026-12-02': { linkedin: 'in_post' },
  '2026-12-03': { linkedin: 'first_comment', whatsapp: 'current' },
  '2026-12-04': { linkedin: 'in_post' },
  '2026-12-05': { linkedin: 'first_comment' },
  '2026-12-06': { linkedin: 'first_comment', whatsapp: 'current' },
  '2026-12-07': { linkedin: 'first_comment', whatsapp: 'short' },
  '2026-12-08': { linkedin: 'first_comment', whatsapp: 'current' },
  '2026-12-09': { linkedin: 'first_comment' },
  '2026-12-10': { linkedin: 'in_post', whatsapp: 'short' },
  '2026-12-11': { linkedin: 'in_post' },
  '2026-12-12': { linkedin: 'in_post' },
  '2026-12-13': { linkedin: 'in_post', whatsapp: 'short' },
  '2026-12-14': { linkedin: 'first_comment', whatsapp: 'short' },
  '2026-12-15': { linkedin: 'first_comment', whatsapp: 'current' },
  '2026-12-16': { linkedin: 'in_post' },
  '2026-12-17': { linkedin: 'in_post', whatsapp: 'current' },
  '2026-12-18': { linkedin: 'first_comment' },
  '2026-12-19': { linkedin: 'in_post' },
  '2026-12-20': { linkedin: 'in_post', whatsapp: 'current' },
  '2026-12-21': { linkedin: 'first_comment', whatsapp: 'short' },
  '2026-12-22': { linkedin: 'in_post', whatsapp: 'short' },
  '2026-12-23': { linkedin: 'first_comment' },
  '2026-12-24': { linkedin: 'in_post', whatsapp: 'current' },
  '2026-12-25': { linkedin: 'first_comment' },
  '2026-12-26': { linkedin: 'first_comment' },
  '2026-12-27': { linkedin: 'first_comment', whatsapp: 'short' },
  '2026-12-28': { linkedin: 'first_comment', whatsapp: 'current' },
  '2026-12-29': { linkedin: 'in_post', whatsapp: 'short' },
  '2026-12-30': { linkedin: 'first_comment' },
  '2026-12-31': { linkedin: 'in_post', whatsapp: 'current' },
}

/** The trial's platforms: Daily Posts' list without X. Telegram still copies WhatsApp. */
export const TRIAL_PLATFORMS: PostingPlatform[] = [
  { platform: 'facebook_il', language: 'he', name: 'Facebook IL', icon: '🇮🇱' },
  { platform: 'whatsapp', language: 'he', name: 'WhatsApp', icon: '💬' },
  { platform: 'telegram', language: 'he', name: 'Telegram', icon: '✈️', derivedFrom: 'whatsapp' },
  { platform: 'linkedin', language: 'en', name: 'LinkedIn', icon: '💼' },
  { platform: 'facebook_intl', language: 'en', name: 'Facebook Intl', icon: '🌍' },
]
const WHATSAPP_PAIR = new Set(['whatsapp', 'telegram'])

export function inTrial(date: string): boolean {
  return date >= TRIAL_START && date <= TRIAL_END
}

export function trialPhase(now: Date): 'before' | 'running' | 'ended' {
  const d = israelDate(now)
  return d < TRIAL_START ? 'before' : d > TRIAL_END ? 'ended' : 'running'
}

/** The trial day (1–31) of an Israel date, or null outside December. */
export function trialDayNumber(date: string): number | null {
  if (!inTrial(date)) return null
  return Number(date.slice(8, 10))
}

/**
 * The assignment that applies on an Israel date. Before the trial the tab previews with Dec 1's; outside the window
 * there is none.
 */
export function assignmentFor(date: string, opts: { preview?: boolean } = {}): DayAssignment | null {
  if (inTrial(date)) return TRIAL_SCHEDULE[date]
  if (opts.preview && date < TRIAL_START) return TRIAL_SCHEDULE[TRIAL_START]
  return null
}

/** WhatsApp (and so Telegram) is posted on Israel Sun / Mon / Tue / Thu. */
export function whatsappDay(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number)
  return [0, 1, 2, 4].includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay())
}

/** The platforms to post on an Israel date (WhatsApp + Telegram only on WhatsApp days). */
export function trialPlatformsFor(date: string): PostingPlatform[] {
  const wa = whatsappDay(date)
  return TRIAL_PLATFORMS.filter(p => wa || !WHATSAPP_PAIR.has(p.platform))
}

/** The variant a platform's post gets on a date (Telegram follows WhatsApp; Facebook has none). */
export function variantFor(platform: string, a: DayAssignment | null): string | null {
  if (!a) return null
  if (platform === 'linkedin') return a.linkedin
  if (WHATSAPP_PAIR.has(platform)) return a.whatsapp ?? null
  return null
}

/**
 * The trial's per-post tracking token in utm_campaign — one per post, so a December visit maps to exactly one trial
 * post. Facebook Intl keeps its 'intl' prefix (its utm_campaign told it apart from IL before the trial); Facebook IL is
 * link-free (its visits arrive via vetree.app/il, campaign 'il').
 */
export function trialCampaign(platform: string, date: string): string | null {
  const ymd = date.replaceAll('-', '')
  if (platform === 'facebook_intl') return `intl-trial-${ymd}`
  if (['linkedin', 'whatsapp', 'telegram'].includes(platform)) return `trial-${ymd}`
  return null
}

/** The platform + date a utm_campaign trial token names, or null. (source decides linkedin / whatsapp / telegram) */
export function parseTrialCampaign(campaign: string | null | undefined): { intl: boolean; date: string } | null {
  const m = /^(intl-)?trial-(\d{4})(\d{2})(\d{2})$/.exec(campaign ?? '')
  if (!m) return null
  const date = `${m[2]}-${m[3]}-${m[4]}`
  return inTrial(date) ? { intl: !!m[1], date } : null
}

// ─── The LinkedIn take line ────────────────────────────────────────────────────────────────────────────────────
/** The model drafts Roi's own view inside this marker; copying is blocked until he rewrites the line. */
export const TAKE_MARKER = '[YOUR TAKE'
export const hasTakePlaceholder = (text: string) => text.includes(TAKE_MARKER)

/** Text features stored with each trial post (derived server-side from the text Roi actually copied). */
export function textFeatures(text: string): { char_count: number; ends_with_question: boolean } {
  const body = text
    .split('\n')
    .filter(l => l.trim() && !/^\s*(📄|🔗|💾|📲|💬)/.test(l) && !/https?:\/\//.test(l))
  const last = body.at(-1)?.trim() ?? ''
  return { char_count: [...text].length, ends_with_question: /[?？]\s*$/.test(last) }
}

/** Dates kept for the trial's draft store (today + 7 days back), like Daily Posts. */
export const draftKeepDates = (today: string) => [0, 1, 2, 3, 4, 5, 6, 7].map(i => israelDateMinus(today, i))
