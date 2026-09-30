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

// PENDING_DIGEST_CONSENT_KEY holds { marketing, lang, at, nonce } since 2026-09-30 (a bare
// boolean before). A Google signup writes it before the OAuth redirect, with no email to bind to,
// so it is bound to THAT OAuth flow: the nonce also travels through the redirect, and
// /auth/callback hands it back in SIGNUP_NONCE_COOKIE as "<nonce>.<userId>" only after that
// flow's sign-in succeeded — bound to the account it signed in — and deletes any leftover cookie
// on every other sign-in. ConsentGate uses the choice only when the nonce matches AND the cookie's
// user is the signed-in user; anyone else is asked afresh. (Codex, 2026-09-30.)
export const PENDING_DIGEST_CONSENT_MAX_AGE_MS = 60 * 60 * 1000
export const SIGNUP_NONCE_COOKIE = 'vetree_signup_nonce'
export const SIGNUP_NONCE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export type PendingDigestConsent = { marketing: boolean; lang?: 'en' | 'he'; at?: number; nonce?: string }
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
        nonce: typeof v.nonce === 'string' && SIGNUP_NONCE_RE.test(v.nonce) ? v.nonce : undefined,
      }
    }
  } catch { /* malformed */ }
  return null
}

/** Cookie value "<nonce>.<userId>" → parts, or null if malformed */
export function parseSignupNonceCookie(raw: string | null): { nonce: string; userId: string } | null {
  if (!raw) return null
  const [nonce, userId, extra] = raw.split('.')
  if (extra !== undefined || !nonce || !userId || !SIGNUP_NONCE_RE.test(nonce) || !SIGNUP_NONCE_RE.test(userId)) return null
  return { nonce, userId }
}

/**
 * The pending digest choice belongs to this user only if it came back through the same OAuth flow
 * (nonce) AND that flow signed in this very account (cookie user = signed-in user).
 */
export function pendingDigestMatchesFlow(
  p: PendingDigestConsent, cookie: { nonce: string; userId: string } | null, signedInUserId: string, now = Date.now(),
): boolean {
  if (!p.nonce || !cookie || p.nonce !== cookie.nonce || cookie.userId !== signedInUserId) return false
  return p.at !== undefined && now - p.at >= 0 && now - p.at <= PENDING_DIGEST_CONSENT_MAX_AGE_MS
}
