'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DigestConsentQuestion } from '@/components/DigestConsentQuestion'
import { PENDING_DIGEST_CONSENT_KEY, PENDING_SIGNUP_CONSENT_KEY, type PendingSignupConsent } from '@/lib/constants/consent'
import { CONSENT_COPY, type ConsentLang } from '@/lib/consent/copy'
import { ConsentLanguageToggle } from '@/components/consent/ConsentLanguageToggle'

// Fire-and-forget, mirrors SaveIntentHandler's trackEvent — the server merges
// device type from the user-agent header, so step-by-device breakdowns don't
// need the client to compute or pass device itself.
function trackEvent(eventName: string, detail?: Record<string, unknown>) {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_name: eventName, detail }),
  }).catch(() => {})
}

// Signup is one step: account + consent, then "check your email". The former steps 2–4 (role,
// focus, specialties) ran before email verification, so their tag follows normally failed
// (401/403, ignored) unless the reader had already verified in another tab; role and branches
// went to localStorage keys nothing read, and focus was never stored. Readers personalize after
// signing in instead.

// ─── Main component ────────────────────────────────────────────────────────

export default function SignUpPage() {
  const supabase = createClient()

  // Account
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted]     = useState(false)
  const [marketingChoice, setMarketingChoice] = useState<boolean | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const [googleLoading, setGoogleLoading]   = useState(false)
  const [pendingVerification, setPendingVerification] = useState(false)
  // Consent wording follows the interface (English); the reader can switch to Hebrew
  const [consentLang, setConsentLang] = useState<ConsentLang>('en')
  const consentCopy = CONSENT_COPY[consentLang]

  // Validation errors render near the top of step 1 (right after the hero copy);
  // the submit button lives in a sticky footer at the bottom. On any viewport
  // shorter than step 1's full content — most phones, plenty of laptops — a
  // fresh error is off-screen with no visual cue, so a rejected submit looks
  // like nothing happened. Scroll it into view whenever it appears.
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  // The funnel keeps its event names; there is now a single step (1)
  useEffect(() => {
    trackEvent('signup_step_viewed', { step: 1 })
  }, [])

  const trackError = (step: number, message: string, surfaced: boolean) => {
    trackEvent('signup_error', { step, message, surfaced })
  }

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleGoogleSignUp = async () => {
    // Fired before the OAuth call, not after — signInWithOAuth navigates the
    // whole page away on success, so there's no "after" to fire from. This is
    // "chose Google and the call didn't error before redirecting," not proof
    // the OAuth round-trip actually completed.
    trackEvent('signup_step_completed', { step: 1, method: 'google' })
    setGoogleLoading(true)
    setError(null)
    // The OAuth redirect is a full page navigation — React state (marketingChoice)
    // doesn't survive it. Persist the choice made on this page so ConsentGate can
    // record it, correctly sourced, the first time it sees this user post-redirect.
    localStorage.setItem(PENDING_DIGEST_CONSENT_KEY, JSON.stringify(marketingChoice === true))
    const returnUrl = new URLSearchParams(window.location.search).get('return') || '/'
    const safeReturn = returnUrl.startsWith('/') ? returnUrl : '/'
    // Through /auth/callback, not the destination directly — see app/login/page.tsx's
    // handleGoogleLogin for why: it exchanges the code for a session server-side
    // before ever redirecting to safeReturn, so a server-guarded page's first
    // render always has it.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeReturn)}` },
    })
    if (error) {
      localStorage.removeItem(PENDING_DIGEST_CONSENT_KEY)
      trackError(1, error.message, true)
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  const handleCreateAccount = async () => {
    setError(null)
    if (password !== confirmPassword) { trackError(1, 'Passwords do not match', true); setError('Passwords do not match'); return }
    if (password.length < 6) { trackError(1, 'Password must be at least 6 characters', true); setError('Password must be at least 6 characters'); return }
    if (!termsAccepted) { trackError(1, 'Terms not accepted', true); setError(consentCopy.termsRequired); return }

    setLoading(true)
    try {
      const returnUrl = new URLSearchParams(window.location.search).get('return') || '/'
      const safeReturn = returnUrl.startsWith('/') ? returnUrl : '/'
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${safeReturn}`,
        },
      })
      if (signUpError) {
        // supabase-js deliberately does NOT parse the response body for 5xx
        // statuses (auth-js lib/fetch.js NETWORK_ERROR_CODES) — it wraps the raw
        // fetch Response in an AuthRetryableFetchError instead, whose .message
        // is JSON.stringify(Response), which is the literal string "{}" (a
        // Response has no own enumerable properties). Rendered verbatim, a user
        // sees a blank, meaningless "{}" and no indication anything went wrong.
        // Confirmed live: Supabase Auth 500s with "Error sending confirmation
        // email" whenever the SMTP send fails synchronously (e.g. no MX record
        // on the recipient domain) — give a real, actionable message instead.
        const isRetryable = signUpError.name === 'AuthRetryableFetchError'
        trackError(1, isRetryable ? `retryable (${signUpError.status}): ${signUpError.message}` : signUpError.message, true)
        setError(isRetryable
          ? 'We couldn’t send your confirmation email just now — this is usually temporary. Please try again in a moment, or use Google instead.'
          : signUpError.message.includes('already registered')
            ? 'This email is already registered. Please log in instead.'
            : signUpError.message)
        setLoading(false)
        return
      }
      if (data.user) {
        // Kept in this browser; ConsentGate records it once the verified owner is signed in
        // (lib/constants/consent PENDING_SIGNUP_CONSENT_KEY)
        if (termsAccepted) {
          try {
            const pending: PendingSignupConsent = {
              terms: true, marketing: marketingChoice === true, version: '1.0',
              email: email.trim().toLowerCase(), at: Date.now(),
            }
            localStorage.setItem(PENDING_SIGNUP_CONSENT_KEY, JSON.stringify(pending))
          } catch { /* storage unavailable: ConsentGate will ask after verification */ }
        }
      }
      trackEvent('signup_step_completed', { step: 1, method: 'email' })
      setPendingVerification(true)
    } catch {
      trackError(1, 'Unexpected error', true)
      setError('An unexpected error occurred. Please try again.')
    }
    setLoading(false)
  }

  // ── Pending verification screen (shown after the account is created) ──────

  if (pendingVerification) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--al-bg)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="var(--al-accent)" style={{ margin: '0 auto 20px' }}>
            <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
          </svg>
          <h1 style={{ margin: '0 0 12px', font: "500 32px/1.12 var(--font-spectral, serif)", color: 'var(--al-ink2)', letterSpacing: '-.015em' }}>
            Check your email.
          </h1>
          <p style={{ margin: '0 0 28px', font: "400 15.5px/1.6 var(--font-instrument, sans-serif)", color: 'var(--al-mut2)' }}>
            We sent a confirmation link to <strong style={{ color: 'var(--al-ink3)' }}>{email}</strong>. Click it to activate your account, then come back to start reading — you can follow the specialties you care about once you&apos;re in.
          </p>
          <Link href="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            background: 'var(--al-accent)', color: 'var(--al-onaccent)',
            borderRadius: 11, padding: '13px 26px',
            font: "600 14.5px/1 var(--font-instrument, sans-serif)",
            textDecoration: 'none',
          }}>
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  // ── Rail + content layout ────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--al-bg)' }}>
      {/* Below 768px the fixed 322px rail leaves ~50-90px for the actual form —
          hide it and let the form take the full viewport. AuthLayout (still used
          by /login) is fluid and never had this problem; this component's custom
          two-column layout (July 3 redesign) never got a mobile breakpoint. */}
      <style>{`
        @media (max-width: 768px) {
          .signup-rail { display: none !important; }
          .signup-main-content { padding: 32px 20px 24px !important; }
          .signup-footer-inner { padding: 16px 20px !important; }
        }
      `}</style>

      {/* ===== BRAND RAIL ===== */}
      <aside className="signup-rail" style={{
        width: 322, flexShrink: 0,
        borderRight: '1px solid rgba(var(--al-line),.1)',
        background: 'radial-gradient(circle at 30% 20%, rgba(var(--al-acct),.08), transparent 55%)',
        padding: '38px 34px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 52 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--al-accent)">
              <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
            </svg>
            <span style={{ font: "600 21px/1 var(--font-spectral, serif)", color: 'var(--al-ink2)' }}>Vetree</span>
          </div>

          <p style={{ margin: 0, font: "400 15px/1.6 var(--font-instrument, sans-serif)", color: 'var(--al-mut2)' }}>
            Evidence-based veterinary research, distilled to the bottom line.
          </p>
        </div>

        <p style={{
          margin: 0,
          font: "italic 400 14px/1.55 var(--font-spectral, serif)",
          color: 'var(--al-mut3)',
        }}>
          &ldquo;Knowledge that branches out, yet stays connected — and feeds the core.&rdquo;
        </p>
      </aside>

      {/* ===== CONTENT ===== */}
      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="signup-main-content" style={{ width: '100%', maxWidth: 660, padding: '64px 44px 48px', flex: 1 }}>

          {/* ── ACCOUNT ── */}
          <>
              <div style={{ font: "600 12px/1 var(--font-instrument, sans-serif)", letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--al-accent)', marginBottom: 14 }}>
                Welcome
              </div>
              <h1 style={{ margin: '0 0 12px', font: "500 40px/1.12 var(--font-spectral, serif)", color: 'var(--al-ink2)', letterSpacing: '-.015em' }}>
                Let&apos;s get you current.
              </h1>
              <p style={{ margin: '0 0 36px', font: "400 16px/1.6 var(--font-instrument, sans-serif)", color: 'var(--al-mut2)', maxWidth: 460 }}>
                Evidence-based veterinary research, distilled to the bottom line. Create your account to grow a feed that&apos;s entirely yours.
              </p>

              {error && (
                <div ref={errorRef} dir="auto" style={{ background: 'rgba(220,60,60,.08)', border: '1px solid rgba(220,60,60,.22)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, font: "400 13.5px/1.5 var(--font-instrument, sans-serif)", color: '#E07070' }}>
                  {error}
                </div>
              )}

              {/* Google */}
              <button
                onClick={handleGoogleSignUp}
                disabled={googleLoading}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
                  background: 'var(--al-card)', border: '1px solid rgba(var(--al-line),.16)',
                  borderRadius: 12, padding: 15,
                  font: "600 14.5px/1 var(--font-instrument, sans-serif)",
                  color: 'var(--al-ink3)', cursor: 'pointer', marginBottom: 22,
                  opacity: googleLoading ? 0.6 : 1,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C17 1.9 14.7.9 12 .9 6.5.9 2 5.4 2 12s4.5 11.1 10 11.1c5.8 0 9.6-4 9.6-9.8 0-.66-.07-1.2-.16-1.7H12z"/>
                </svg>
                {googleLoading ? 'Connecting…' : 'Continue with Google'}
              </button>

              {/* Or divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
                <span style={{ flex: 1, height: 1, background: 'rgba(var(--al-line),.12)' }} />
                <span style={{ font: "400 12px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut6)' }}>or</span>
                <span style={{ flex: 1, height: 1, background: 'rgba(var(--al-line),.12)' }} />
              </div>

              {/* Email + password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@practice.com"
                  style={{
                    background: 'var(--al-card)', border: '1px solid rgba(var(--al-line),.13)',
                    borderRadius: 12, padding: '15px 16px',
                    color: 'var(--al-ink3)', font: "400 14.5px/1 var(--font-instrument, sans-serif)", outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--al-accent)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(var(--al-line),.13)'}
                />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create a password"
                  style={{
                    background: 'var(--al-card)', border: '1px solid rgba(var(--al-line),.13)',
                    borderRadius: 12, padding: '15px 16px',
                    color: 'var(--al-ink3)', font: "400 14.5px/1 var(--font-instrument, sans-serif)", outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--al-accent)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(var(--al-line),.13)'}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  style={{
                    background: 'var(--al-card)', border: '1px solid rgba(var(--al-line),.13)',
                    borderRadius: 12, padding: '15px 16px',
                    color: 'var(--al-ink3)', font: "400 14.5px/1 var(--font-instrument, sans-serif)", outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--al-accent)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(var(--al-line),.13)'}
                />
              </div>

              {/* Consent in the interface language (English), switchable to Hebrew */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <ConsentLanguageToggle lang={consentLang} onChange={setConsentLang} />
              </div>

              {/* Terms checkbox — Israeli Privacy Protection Law requirement */}
              <div dir={consentCopy.dir} lang={consentLang} style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--al-accent)' }}
                  />
                  <span style={{ font: "400 12.5px/1.5 var(--font-instrument, sans-serif)", color: 'var(--al-mut2)' }}>
                    {consentCopy.termsBefore}<a href="/terms" target="_blank" style={{ color: 'var(--al-accent)' }}>{consentCopy.terms}</a>{consentCopy.and}<a href="/privacy" target="_blank" style={{ color: 'var(--al-accent)' }}>{consentCopy.privacy}</a>{consentCopy.termsAfter} <span style={{ color: '#E07070' }}>*</span>
                  </span>
                </label>
              </div>

              {/* Digest consent — dedicated element, explicit Yes/No, never pre-checked */}
              <div style={{ marginBottom: 16 }}>
                <DigestConsentQuestion lang={consentLang} value={marketingChoice} onChange={setMarketingChoice} />
              </div>

              <div style={{ font: "400 13px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)', textAlign: 'center' }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: 'var(--al-accent)' }}>Log in</Link>
              </div>
          </>

        </div>

        {/* ── STICKY BOTTOM NAV ── */}
        <div style={{
          position: 'sticky', bottom: 0, width: '100%',
          background: 'rgba(var(--al-bar),.9)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(var(--al-line),.1)',
        }}>
          <div className="signup-footer-inner" style={{
            maxWidth: 660, margin: '0 auto', padding: '18px 44px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span />

            <button
              onClick={handleCreateAccount}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                background: 'var(--al-accent)', color: 'var(--al-onaccent)',
                border: 'none', borderRadius: 11, padding: '13px 26px',
                font: "600 14.5px/1 var(--font-instrument, sans-serif)",
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'filter .15s',
              }}
            >
              {loading ? 'Creating account…' : 'Create account'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
