// Growth OS daily posts (growth-002) — the pure rules behind app/admin/growth/DailyPosts.tsx, the feedback route's
// one-row-per-day dedup and /api/admin/growth/today. No React, no Supabase: tested offline in tests/unit/daily.test.ts.
//
// The owner's flow (Roi, 2026-10-13): every day ONE article is posted to EVERY platform below. Generate All writes one
// post per generated platform for the same article; Telegram is the WhatsApp post with its UTM switched (no model call).
// The 90-day platform rotation is gone.

export type PostingPlatform = {
  platform: string
  language: 'he' | 'en'
  name: string
  icon: string
  /** Telegram is derived from another platform's post instead of generated */
  derivedFrom?: string
}

export const POSTING_PLATFORMS: PostingPlatform[] = [
  { platform: 'facebook_il', language: 'he', name: 'Facebook IL', icon: '🇮🇱' },
  { platform: 'whatsapp', language: 'he', name: 'WhatsApp', icon: '💬' },
  { platform: 'telegram', language: 'he', name: 'Telegram', icon: '✈️', derivedFrom: 'whatsapp' },
  { platform: 'linkedin', language: 'en', name: 'LinkedIn', icon: '💼' },
  { platform: 'facebook_intl', language: 'en', name: 'Facebook Intl', icon: '🌍' },
  { platform: 'twitter', language: 'en', name: 'X', icon: '𝕏' },
]

export const GENERATED_PLATFORMS = POSTING_PLATFORMS.filter(p => !p.derivedFrom)
export const platformInfo = (platform: string) => POSTING_PLATFORMS.find(p => p.platform === platform)

/** The Telegram post: the WhatsApp post with every link's utm_source switched to telegram. */
export function telegramFromWhatsapp(post: string): string {
  return post.replace(/([?&])utm_source=whatsapp\b/g, '$1utm_source=telegram')
}

// ─── Days are Israel days (Roi posts in the morning, Asia/Jerusalem) ─────────────────────────────────────────────
const TZ = 'Asia/Jerusalem'
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
})

/** The Israel calendar date of an instant, as YYYY-MM-DD. */
export function israelDate(at: Date | string | number): string {
  return ymd.format(new Date(at))
}

// Israel's offset from UTC at an instant, in ms (+2 h in winter, +3 h in summer)
function offsetMs(at: number): number {
  const p = Object.fromEntries(parts.formatToParts(new Date(at)).map(x => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUtc - Math.floor(at / 1000) * 1000
}

/** The UTC instants [start, end) of an Israel calendar day (23 or 25 hours on the DST switch days). */
export function israelDayBounds(date: string): { start: string; end: string } {
  const [y, m, d] = date.split('-').map(Number)
  const midnight = (yy: number, mm: number, dd: number) => {
    const guess = Date.UTC(yy, mm - 1, dd)
    // two passes: the offset at the guess, then at the corrected instant (they differ only around a switch)
    const first = guess - offsetMs(guess)
    return guess - offsetMs(first)
  }
  const start = midnight(y, m, d)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const end = midnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() }
}

/** The Israel date `days` before `date` (YYYY-MM-DD). */
export function israelDateMinus(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d - days))
  return t.toISOString().slice(0, 10)
}

/**
 * Consecutive posting days ending today — or ending yesterday while today has nothing yet (the day isn't over).
 * `postedDates` are Israel dates with at least one post.
 */
export function postingStreak(postedDates: Iterable<string>, today: string): number {
  const days = new Set(postedDates)
  let streak = 0
  let day = days.has(today) ? today : israelDateMinus(today, 1)
  while (days.has(day)) {
    streak++
    day = israelDateMinus(day, 1)
  }
  return streak
}

// ─── One article per day ─────────────────────────────────────────────────────────────────────────────────────────
export type ApprovedRow = { id: string; article_id: string; platform: string; created_at: string; posted_url: string | null }
export type Draft = { article_id: string; post_content: string; article_title?: string }

/**
 * What the panel starts from: an approval today fixes the day's article (drafts for any other article are dropped);
 * without one, drafts are kept only if they all share one article.
 */
export function reconcileDay(drafts: Record<string, Draft>, approvedToday: ApprovedRow[]): {
  articleId: string | null
  drafts: Record<string, Draft>
  dropped: string[]
} {
  const fixed = approvedToday.length ? newest(approvedToday).article_id : null
  const ids = new Set(Object.values(drafts).map(d => d.article_id))
  const articleId = fixed ?? (ids.size === 1 ? [...ids][0] : null)
  const kept: Record<string, Draft> = {}
  const dropped: string[] = []
  for (const [platform, draft] of Object.entries(drafts)) {
    if (articleId && draft.article_id === articleId) kept[platform] = draft
    else dropped.push(platform)
  }
  return { articleId, drafts: kept, dropped }
}

const newest = (rows: ApprovedRow[]) => rows.reduce((a, b) => (b.created_at > a.created_at ? b : a))

/** The platforms marked as posted today for the day's article (a post for another article never counts). */
export function postedPlatforms(approvedToday: ApprovedRow[], articleId: string | null): Set<string> {
  return new Set(approvedToday.filter(r => r.article_id === articleId).map(r => r.platform))
}
