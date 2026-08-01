// Shared between app/signup/page.tsx (writer, before the Google OAuth redirect strips
// React state) and components/ConsentGate.tsx (reader, on first authenticated load
// after the redirect returns). Google OAuth is a full-page redirect — there is no
// other way to carry the signup page's digest choice across it.
export const PENDING_DIGEST_CONSENT_KEY = 'vetree_pending_digest_consent'
