'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PENDING_DIGEST_CONSENT_KEY, PENDING_SIGNUP_CONSENT_KEY, PENDING_SIGNUP_CONSENT_MAX_AGE_MS, type PendingSignupConsent } from '@/lib/constants/consent'
import { CONSENT_COPY, type ConsentLang } from '@/lib/consent/copy'
import { ConsentLanguageToggle } from '@/components/consent/ConsentLanguageToggle'

// Terms-acceptance gate only — mandatory, blocking. Marketing/digest consent is
// NOT asked here; it's asked properly by the dedicated signup step (Part 2) and
// the one-time dismissible in-app prompt (Part 3). This still has to write a
// marketing_opted_in value on submit (the column is NOT NULL), but writes it with
// consent_source: null — a placeholder, not a decline — so those two other flows
// remain free to make a real, dedicated ask later. The one exception: a Google
// signup that already answered the digest question on the signup page before the
// OAuth redirect (which React state can't survive) — that choice is picked up
// from localStorage here, on this same first-consent-row write, correctly sourced.
function readPendingSignupConsent(userEmail: string | undefined): PendingSignupConsent | null {
  try {
    const raw = localStorage.getItem(PENDING_SIGNUP_CONSENT_KEY)
    if (!raw || !userEmail) return null
    let p: PendingSignupConsent | null = null
    try { p = JSON.parse(raw) } catch { p = null }
    const age = p && typeof p.at === 'number' && Number.isFinite(p.at) ? Date.now() - p.at : NaN
    const valid = !!p && p.terms === true && typeof p.marketing === 'boolean' && p.version === '1.0'
      && typeof p.email === 'string' && p.email === userEmail.trim().toLowerCase()
      && age >= 0 && age < PENDING_SIGNUP_CONSENT_MAX_AGE_MS
    if (!valid) { localStorage.removeItem(PENDING_SIGNUP_CONSENT_KEY); return null }
    return p
  } catch {
    return null // storage unavailable
  }
}

export function ConsentGate() {
  const [show, setShow] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  // Consent wording follows the interface (English); the reader can switch to Hebrew
  const [lang, setLang] = useState<ConsentLang>('en')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return

      // Check if consent record exists
      const { data: consent } = await supabase
        .from('user_consents')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!consent) {
        // Email signup made its choices in this browser before verification. Record them now, as
        // the verified owner, if they were made for THIS email and aren't stale — otherwise ask.
        const pending = readPendingSignupConsent(user.email)
        if (pending) {
          try {
            const res = await fetch('/api/auth/save-consent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              // userId pins the write to the user the pending choice was validated against: if the
              // session changed meanwhile (another tab signed in as someone else), the route's
              // session/userId check rejects it and the gate asks instead
              body: JSON.stringify({ userId: user.id, termsAccepted: true, marketingOptIn: pending.marketing, consentSource: 'signup' }),
            })
            if (res.ok) {
              localStorage.removeItem(PENDING_SIGNUP_CONSENT_KEY)
              return
            }
            if (res.status === 403) {
              // The session changed under us: open the gate for whoever is signed in NOW
              const { data: { user: current } } = await supabase.auth.getUser()
              if (!current) return
              setUserId(current.id)
              setShow(true)
              return
            }
          } catch { /* fall through to the gate */ }
        }
        setUserId(user.id)
        setShow(true)
      }
    })
  }, [])

  const handleSubmit = async () => {
    if (!termsAccepted) {
      setError(CONSENT_COPY[lang].termsRequired)
      return
    }
    if (!userId) return

    setSaving(true)
    setError(null)

    // A Google signup on app/signup/page.tsx may have already asked and stashed
    // the digest choice before the OAuth redirect. Pick it up here, on this same
    // first-ever consent row, correctly sourced — otherwise it's a placeholder.
    let marketingOptIn = false
    let consentSource: 'signup' | null = null
    const pending = localStorage.getItem(PENDING_DIGEST_CONSENT_KEY)
    if (pending !== null) {
      try {
        marketingOptIn = JSON.parse(pending) === true
        consentSource = 'signup'
      } catch { /* malformed value, ignore */ }
    }

    try {
      const res = await fetch('/api/auth/save-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, termsAccepted, marketingOptIn, consentSource }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || CONSENT_COPY[lang].gateSaveError)
        setSaving(false)
        return
      }

      localStorage.removeItem(PENDING_DIGEST_CONSENT_KEY)
      setShow(false)
    } catch {
      setError(CONSENT_COPY[lang].gateSaveError)
      setSaving(false)
    }
  }

  if (!show) return null
  const copy = CONSENT_COPY[lang]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-xl max-w-md w-full p-8"
        dir={copy.dir}
        lang={lang}
      >
        <div className="flex justify-end mb-2">
          <ConsentLanguageToggle lang={lang} onChange={setLang} />
        </div>
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🌿</div>
          <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
            {copy.gateTitle}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {copy.gateBody}
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[#3D7A5F] focus:ring-[#3D7A5F] flex-shrink-0"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug">
              {copy.termsBefore}
              <a href="/terms" target="_blank" className="text-[#3D7A5F] dark:text-[#4E9A78] hover:underline">{copy.terms}</a>
              {copy.and}
              <a href="/privacy" target="_blank" className="text-[#3D7A5F] dark:text-[#4E9A78] hover:underline">{copy.privacy}</a>
              {copy.termsAfter}{' '}
              <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        {error && (
          <p dir="auto" className="text-red-600 dark:text-red-400 text-sm mb-4 text-center">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving || !termsAccepted}
          className="w-full bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-3 font-medium transition-colors"
        >
          {saving ? copy.gateSaving : copy.gateSubmit}
        </button>
      </div>
    </div>
  )
}
