// Helpers for Admin → Analytics → Google Search (analytics-001, migration 088). Pure; tests/unit/searchConsoleView.test.ts.

export const SEARCH_CONSOLE_RANGES = [7, 28, 90] as const
export type SearchConsoleRange = (typeof SEARCH_CONSOLE_RANGES)[number]

// Hosts whose Search Console pages are vetree.app pages, so page_views (which stores only the path) can be joined.
// www redirects to the apex. Any other host of the domain property gets no local metrics.
export const LOCAL_HOSTS = new Set(['vetree.app', 'www.vetree.app'])

// A Google search / Google app referrer, by hostname (not a substring of the URL): google.com, google.co.il, …,
// and the Android Google app. page_views keeps the browser's referrer for later in-app pages too, so a count of
// these includes later pages of the same visit — the dashboard says so.
export function isGoogleReferrer(referrer: string | null | undefined): boolean {
  if (!referrer) return false
  let u: URL
  try { u = new URL(referrer) } catch { return false }
  if (u.protocol === 'android-app:') return u.hostname === 'com.google.android.googlequicksearchbox'
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
  return /^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(u.hostname.toLowerCase())
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const pacificParts = (t: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(t)

// The UTC instant of 00:00 Pacific on `day` (07:00Z in daylight time, 08:00Z in standard time)
export function pacificMidnightUtc(day: string): string {
  for (const hour of ['07', '08']) {
    const t = new Date(`${day}T${hour}:00:00Z`)
    if (pacificParts(t) === `${day}, 00:00`) return t.toISOString()
  }
  throw new Error(`no Pacific midnight for ${day}`)
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// '/article/pubmed-42908201' → 'pubmed-42908201'
export function articleIdFromPath(path: string): string | null {
  const m = /^\/article\/([^/?#]+)\/?$/.exec(path)
  return m ? decodeURIComponent(m[1]) : null
}
