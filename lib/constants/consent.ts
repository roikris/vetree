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
export type PendingSignupConsent = { terms: true; marketing: boolean; version: '1.0'; email: string; at: number }
