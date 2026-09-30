/**
 * Optional tracking consent: the LinkedIn Insight Tag and the Meta Pixel (ad measurement — the only
 * optional purpose) load only after the visitor accepts (components/consent/TrackingConsent). Stored
 * per browser; the choice can be changed from "Cookie settings". Everything else Vetree needs
 * (sign-in, first-party analytics, error reports) doesn't depend on it.
 */
export type TrackingChoice = 'accepted' | 'rejected'

const KEY = 'vetree_tracking_consent'
export const TRACKING_CONSENT_EVENT = 'vetree:tracking-consent'
export const TRACKING_SETTINGS_EVENT = 'vetree:tracking-settings'

// Kept in several places, so a failed write can never turn a rejection back into acceptance: this
// page's memory, localStorage, a first-party cookie, and — for a rejection — the tab's window.name,
// which survives the reload that withdrawal triggers even when storage and cookies are blocked.
// A rejection anywhere wins.
let memoryChoice: TrackingChoice | null = null
const REJECT_MARK = 'vetree-tracking-rejected'
function fromWindowName(): TrackingChoice | null {
  try { return window.name.includes(REJECT_MARK) ? 'rejected' : null } catch { return null }
}

function fromStorage(): TrackingChoice | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    return v?.choice === 'accepted' || v?.choice === 'rejected' ? v.choice : null
  } catch {
    return null
  }
}
function fromCookie(): TrackingChoice | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${KEY}=(accepted|rejected)`))
    return m ? (m[1] as TrackingChoice) : null
  } catch {
    return null
  }
}

export function readTrackingChoice(): TrackingChoice | null {
  const all = [memoryChoice, fromStorage(), fromCookie(), fromWindowName()]
  if (all.includes('rejected')) return 'rejected'
  if (all.includes('accepted')) return 'accepted'
  return null
}

export function writeTrackingChoice(choice: TrackingChoice) {
  memoryChoice = choice
  try { localStorage.setItem(KEY, JSON.stringify({ choice, at: new Date().toISOString(), v: 1 })) } catch { /* unavailable */ }
  try { document.cookie = `${KEY}=${choice}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax; Secure` } catch { /* unavailable */ }
  try {
    const rest = window.name.split(' ').filter(p => p && p !== REJECT_MARK)
    window.name = (choice === 'rejected' ? [...rest, REJECT_MARK] : rest).join(' ')
  } catch { /* unavailable */ }
  window.dispatchEvent(new CustomEvent(TRACKING_CONSENT_EVENT, { detail: choice }))
}

/** Re-opens the consent bar (the "Cookie settings" link) */
export function openTrackingSettings() {
  window.dispatchEvent(new Event(TRACKING_SETTINGS_EVENT))
}
