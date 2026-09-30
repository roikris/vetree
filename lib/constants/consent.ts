// Shared between app/signup/page.tsx (writer, before the Google OAuth redirect strips
// React state) and components/ConsentGate.tsx (reader, on first authenticated load
// after the redirect returns). Google OAuth is a full-page redirect — there is no
// other way to carry the signup page's digest choice across it.
export const PENDING_DIGEST_CONSENT_KEY = 'vetree_pending_digest_consent'

// Email signup's consent choices, kept in THIS browser until the account is verified and has a
// session; ConsentGate then records them as the verified owner (session-bound route). A choice
// made before verification can't be proven to be the email owner's (anyone can start a signup
// with someone else's address), so it is never recorded server-side before that. The stored
// email must match the signed-in user, and it expires, so a shared browser can't leak a choice.
export const PENDING_SIGNUP_CONSENT_KEY = 'vetree_pending_signup_consent'
export const PENDING_SIGNUP_CONSENT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
// lang: the language of the consent wording on the signup page (both questions); absent on
// payloads written before 2026-09-30
export type PendingSignupConsent = { terms: true; marketing: boolean; version: '1.0'; email: string; at: number; lang?: 'en' | 'he' }

// PENDING_DIGEST_CONSENT_KEY holds { marketing, lang, at } since 2026-09-30 (a bare boolean
// before). It is written by a Google signup before the OAuth redirect and has no email to bind
// to, so it may only be used by an account CREATED within the hour after it was written — the
// signup that wrote it. Anyone else signing in on this browser is asked afresh (Codex, 2026-09-30).
export const PENDING_DIGEST_CONSENT_MAX_AGE_MS = 60 * 60 * 1000
export type PendingDigestConsent = { marketing: boolean; lang?: 'en' | 'he'; at?: number }
export function parsePendingDigestConsent(raw: string | null): PendingDigestConsent | null {
  if (raw === null) return null
  try {
    const v = JSON.parse(raw)
    if (typeof v === 'boolean') return { marketing: v }
    if (v && typeof v.marketing === 'boolean') {
      return {
        marketing: v.marketing,
        lang: v.lang === 'en' || v.lang === 'he' ? v.lang : undefined,
        at: typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : undefined,
      }
    }
  } catch { /* malformed */ }
  return null
}

/** The pending digest choice belongs to this user only if they signed up right after it was written */
export function pendingDigestBelongsTo(p: PendingDigestConsent, userCreatedAt: string | undefined, now = Date.now()): boolean {
  const created = userCreatedAt ? Date.parse(userCreatedAt) : NaN
  if (!Number.isFinite(created) || now - created > PENDING_DIGEST_CONSENT_MAX_AGE_MS) return false
  // Legacy payloads (no timestamp, written before this change) are trusted only via a fresh account
  if (p.at === undefined) return true
  return p.at <= created + 60_000 && created - p.at <= PENDING_DIGEST_CONSENT_MAX_AGE_MS
}
