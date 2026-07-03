'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getLabelHue } from '@/lib/constants/labelColors'

// ─── Data ────────────────────────────────────────────────────────────────────

const STEP_DEFS = [
  { n: 1, label: 'Account',    hint: 'Create your login' },
  { n: 2, label: 'About you',  hint: 'Role & focus' },
  { n: 3, label: 'Your grove', hint: 'Follow specialties' },
  { n: 4, label: 'Ready',      hint: 'Start reading' },
]

const ROLE_OPTS = ['Veterinarian', 'Vet nurse / technician', 'Student', 'Researcher']

const FOCUS_OPTS = ['Small animal', 'Large animal', 'Equine', 'Exotic', 'Mixed practice']

const SPECIALTIES = [
  'Anesthesia', 'Behavior', 'Cardiology', 'Dentistry', 'Dermatology',
  'Emergency', 'Equine', 'Exotic', 'Internal Medicine', 'Neurology',
  'Nutrition', 'Oncology', 'Ophthalmology', 'Orthopedics', 'Pathology',
  'Pharmacology', 'Radiology', 'Reproduction', 'Soft Tissue Surgery',
]

// ─── Dot step indicator ────────────────────────────────────────────────────

function StepDot({ n, current, done }: { n: number; current: boolean; done: boolean }) {
  const base: React.CSSProperties = {
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    font: "600 12.5px/1 var(--font-instrument, sans-serif)",
    transition: 'all .2s',
  }
  if (current) return (
    <span style={{ ...base, background: 'var(--al-accent)', color: 'var(--al-onaccent)' }}>{n}</span>
  )
  if (done) return (
    <span style={{ ...base, background: 'rgba(var(--al-acct),.18)', color: 'var(--al-accent)', border: '1px solid rgba(var(--al-acct),.4)' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5"/>
      </svg>
    </span>
  )
  return (
    <span style={{ ...base, background: 'var(--al-card)', color: 'var(--al-mut6)', border: '1px solid rgba(var(--al-line),.14)' }}>{n}</span>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function SignUpPage() {
  const router = useRouter()
  const supabase = createClient()

  // Step state
  const [step, setStep] = useState(1)

  // Step 1 — account
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted]     = useState(false)
  const [marketingOptIn, setMarketingOptIn]   = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const [googleLoading, setGoogleLoading]   = useState(false)
  const [pendingVerification, setPendingVerification] = useState(false)
  const [createdUserId, setCreatedUserId] = useState<string | null>(null)

  // Step 2 — about you
  const [role, setRole]   = useState('Veterinarian')
  const [focus, setFocus] = useState<Set<string>>(new Set(['Small animal']))

  // Step 3 — grove
  const [branches, setBranches] = useState<Set<string>>(
    new Set(['Cardiology', 'Emergency', 'Internal Medicine', 'Ophthalmology'])
  )

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  const handleCreateAccount = async () => {
    setError(null)
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!termsAccepted) { setError('יש לאשר את תנאי השימוש ומדיניות הפרטיות כדי להמשיך'); return }

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        setError(signUpError.message.includes('already registered')
          ? 'This email is already registered. Please log in instead.'
          : signUpError.message)
        setLoading(false)
        return
      }
      if (data.user) {
        setCreatedUserId(data.user.id)
        // Save consent (non-blocking)
        fetch('/api/auth/save-consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.user.id, termsAccepted, marketingOptIn }),
        }).catch(() => {})
      }
      // Advance to step 2
      setStep(2)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    }
    setLoading(false)
  }

  const handleEnterVetree = async () => {
    // Save specialties to localStorage so they can be applied post-verification
    if (typeof window !== 'undefined') {
      localStorage.setItem('vetree_onboarding_role', role)
      localStorage.setItem('vetree_onboarding_branches', JSON.stringify(Array.from(branches)))
    }
    // Try to follow tags if session exists
    try {
      await Promise.all(
        Array.from(branches).map(tag =>
          fetch('/api/tags/follow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag }),
          })
        )
      )
    } catch { /* non-critical */ }

    // Show verification reminder if email signup, then go home
    setPendingVerification(true)
  }

  const toggleFocus = (f: string) => {
    setFocus(prev => {
      const next = new Set(prev)
      next.has(f) ? next.delete(f) : next.add(f)
      return next
    })
  }

  const toggleBranch = (b: string) => {
    setBranches(prev => {
      const next = new Set(prev)
      next.has(b) ? next.delete(b) : next.add(b)
      return next
    })
  }

  // ── Pending verification screen (shown after "Enter Vetree") ─────────────

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
            We sent a confirmation link to <strong style={{ color: 'var(--al-ink3)' }}>{email}</strong>. Click it to activate your account, then come back to start reading.
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

      {/* ===== BRAND RAIL ===== */}
      <aside style={{
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

          {/* Progress steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {STEP_DEFS.map(s => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0' }}>
                <StepDot n={s.n} current={s.n === step} done={s.n < step} />
                <div>
                  <div style={{
                    font: s.n === step
                      ? "600 14px/1.2 var(--font-instrument, sans-serif)"
                      : "500 14px/1.2 var(--font-instrument, sans-serif)",
                    color: s.n === step ? 'var(--al-ink2)' : s.n < step ? 'var(--al-sub)' : 'var(--al-mut6)',
                  }}>
                    {s.label}
                  </div>
                  <div style={{ font: "400 12px/1.3 var(--font-instrument, sans-serif)", color: 'var(--al-mut6)', marginTop: 2 }}>
                    {s.hint}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{
          margin: 0,
          font: "italic 400 14px/1.55 var(--font-spectral, serif)",
          color: 'var(--al-mut3)',
        }}>
          "Knowledge that branches out, yet stays connected — and feeds the core."
        </p>
      </aside>

      {/* ===== CONTENT ===== */}
      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 660, padding: '64px 44px 48px', flex: 1 }}>

          {/* ── STEP 1: ACCOUNT ── */}
          {step === 1 && (
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
                <div style={{ background: 'rgba(220,60,60,.08)', border: '1px solid rgba(220,60,60,.22)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, font: "400 13.5px/1.5 var(--font-instrument, sans-serif)", color: '#E07070' }}>
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

              {/* Consent checkboxes — Israeli Privacy Protection Law requirement */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, direction: 'rtl' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--al-accent)' }}
                  />
                  <span style={{ font: "400 12.5px/1.5 var(--font-instrument, sans-serif)", color: 'var(--al-mut2)' }}>
                    קראתי ואני מסכים/ה ל<a href="/terms" target="_blank" style={{ color: 'var(--al-accent)' }}>תנאי השימוש</a> ול<a href="/privacy" target="_blank" style={{ color: 'var(--al-accent)' }}>מדיניות הפרטיות</a> של Vetree. <span style={{ color: '#E07070' }}>*</span>
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={e => setMarketingOptIn(e.target.checked)}
                    style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--al-accent)' }}
                  />
                  <span style={{ font: "400 12.5px/1.5 var(--font-instrument, sans-serif)", color: 'var(--al-mut2)' }}>
                    אני מאשר/ת קבלת עדכונים שבועיים מ-Vetree בדוא&quot;ל. ניתן לבטל בכל עת.
                  </span>
                </label>
              </div>

              <div style={{ font: "400 13px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)', textAlign: 'center' }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: 'var(--al-accent)' }}>Log in</Link>
              </div>
            </>
          )}

          {/* ── STEP 2: ABOUT YOU ── */}
          {step === 2 && (
            <>
              <div style={{ font: "600 12px/1 var(--font-instrument, sans-serif)", letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--al-accent)', marginBottom: 14 }}>
                About you
              </div>
              <h1 style={{ margin: '0 0 12px', font: "500 38px/1.14 var(--font-spectral, serif)", color: 'var(--al-ink2)', letterSpacing: '-.015em' }}>
                Tell us who you are.
              </h1>
              <p style={{ margin: '0 0 30px', font: "400 15.5px/1.6 var(--font-instrument, sans-serif)", color: 'var(--al-mut2)' }}>
                We tune the language and the evidence bar to match your work.
              </p>

              <div style={{ font: "600 13px/1 var(--font-instrument, sans-serif)", color: 'var(--al-body)', marginBottom: 13 }}>
                Your role
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 32 }}>
                {ROLE_OPTS.map(name => {
                  const active = role === name
                  return (
                    <button
                      key={name}
                      onClick={() => setRole(name)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', textAlign: 'left', padding: '15px 18px',
                        borderRadius: 13, cursor: 'pointer',
                        font: `${active ? '600' : '500'} 14.5px/1 var(--font-instrument, sans-serif)`,
                        background: active ? 'rgba(var(--al-acct),.12)' : 'var(--al-card)',
                        border: active ? '1.5px solid var(--al-accent)' : '1.5px solid rgba(var(--al-line),.1)',
                        color: active ? 'var(--al-ink2)' : 'var(--al-sub)',
                        transition: 'all .15s',
                      }}
                    >
                      {name}
                      {active && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--al-accent)" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5"/>
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>

              <div style={{ font: "600 13px/1 var(--font-instrument, sans-serif)", color: 'var(--al-body)', marginBottom: 13 }}>
                Your focus{' '}
                <span style={{ color: 'var(--al-mut6)', fontWeight: 400 }}>· choose any</span>
              </div>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {FOCUS_OPTS.map(name => {
                  const active = focus.has(name)
                  return (
                    <button
                      key={name}
                      onClick={() => toggleFocus(name)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: active ? 7 : 0,
                        padding: '10px 16px', borderRadius: 999, cursor: 'pointer',
                        font: `${active ? '600' : '500'} 13.5px/1 var(--font-instrument, sans-serif)`,
                        background: active ? 'rgba(var(--al-acct),.14)' : 'var(--al-card)',
                        border: active ? '1.5px solid var(--al-accent)' : '1.5px solid rgba(var(--al-line),.12)',
                        color: active ? 'var(--al-accent)' : 'var(--al-sub)',
                        transition: 'all .15s',
                      }}
                    >
                      {active && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5"/>
                        </svg>
                      )}
                      {name}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* ── STEP 3: YOUR GROVE ── */}
          {step === 3 && (
            <>
              <div style={{ font: "600 12px/1 var(--font-instrument, sans-serif)", letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--al-accent)', marginBottom: 14 }}>
                Your grove
              </div>
              <h1 style={{ margin: '0 0 12px', font: "500 38px/1.14 var(--font-spectral, serif)", color: 'var(--al-ink2)', letterSpacing: '-.015em' }}>
                Plant your branches.
              </h1>
              <p style={{ margin: '0 0 26px', font: "400 15.5px/1.6 var(--font-instrument, sans-serif)", color: 'var(--al-mut2)' }}>
                Follow the specialties you care about — your Stream and Grove grow from these. Prune or add anytime.
              </p>

              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {SPECIALTIES.map(name => {
                  const active = branches.has(name)
                  const hue = getLabelHue(name)
                  return (
                    <button
                      key={name}
                      onClick={() => toggleBranch(name)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: active ? 7 : 0,
                        padding: '10px 16px', borderRadius: 999, cursor: 'pointer',
                        font: `${active ? '600' : '500'} 13.5px/1 var(--font-instrument, sans-serif)`,
                        background: active ? `${hue}26` : 'var(--al-card)',
                        border: active ? `1.5px solid ${hue}` : '1.5px solid rgba(var(--al-line),.12)',
                        color: active ? hue : 'var(--al-sub)',
                        transition: 'all .15s',
                      }}
                    >
                      {active && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5"/>
                        </svg>
                      )}
                      {name}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* ── STEP 4: READY ── */}
          {step === 4 && (
            <>
              <div style={{ font: "600 12px/1 var(--font-instrument, sans-serif)", letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--al-accent)', marginBottom: 14 }}>
                All set
              </div>
              <h1 style={{ margin: '0 0 12px', font: "500 40px/1.12 var(--font-spectral, serif)", color: 'var(--al-ink2)', letterSpacing: '-.015em' }}>
                Your grove is planted.
              </h1>
              <p style={{ margin: '0 0 30px', font: "400 16px/1.6 var(--font-instrument, sans-serif)", color: 'var(--al-mut2)' }}>
                <span style={{ color: 'var(--al-accent)', fontWeight: 600 }}>{branches.size} branches</span> followed.{' '}
                Fresh bottom lines will land in your Stream every day.
              </p>

              {/* Selected branches summary card */}
              <div style={{
                background: 'var(--al-card)', border: '1px solid rgba(var(--al-line),.1)',
                borderRadius: 16, padding: '24px 26px', marginBottom: 8,
              }}>
                <div style={{
                  font: "600 11px/1 var(--font-instrument, sans-serif)",
                  letterSpacing: '.14em', textTransform: 'uppercase',
                  color: 'var(--al-mut4)', marginBottom: 16,
                }}>
                  Following
                </div>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  {Array.from(branches).map(name => {
                    const hue = getLabelHue(name)
                    return (
                      <span key={name} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 999,
                        font: "600 13px/1 var(--font-instrument, sans-serif)",
                        background: `${hue}26`,
                        border: `1px solid ${hue}88`,
                        color: hue,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5"/>
                        </svg>
                        {name}
                      </span>
                    )
                  })}
                </div>
              </div>
            </>
          )}

        </div>

        {/* ── STICKY BOTTOM NAV ── */}
        <div style={{
          position: 'sticky', bottom: 0, width: '100%',
          background: 'rgba(var(--al-bar),.9)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(var(--al-line),.1)',
        }}>
          <div style={{
            maxWidth: 660, margin: '0 auto', padding: '18px 44px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            {/* Back button */}
            {step > 1 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  font: "600 14px/1 var(--font-instrument, sans-serif)",
                  color: 'var(--al-mut3)', padding: 0,
                }}
              >
                ← Back
              </button>
            ) : (
              <span />
            )}

            {/* Continue / Create account / Enter Vetree */}
            {step < 4 ? (
              <button
                onClick={step === 1 ? handleCreateAccount : () => setStep(s => s + 1)}
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
                {loading ? 'Creating account…' : step === 1 ? 'Create account' : 'Continue'}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              </button>
            ) : (
              <button
                onClick={handleEnterVetree}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  background: 'var(--al-accent)', color: 'var(--al-onaccent)',
                  border: 'none', borderRadius: 11, padding: '13px 30px',
                  font: "600 14.5px/1 var(--font-instrument, sans-serif)", cursor: 'pointer',
                  transition: 'filter .15s',
                }}
              >
                Enter Vetree
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
