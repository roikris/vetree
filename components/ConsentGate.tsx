'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PENDING_DIGEST_CONSENT_KEY } from '@/lib/constants/consent'

// Terms-acceptance gate only — mandatory, blocking. Marketing/digest consent is
// NOT asked here; it's asked properly by the dedicated signup step (Part 2) and
// the one-time dismissible in-app prompt (Part 3). This still has to write a
// marketing_opted_in value on submit (the column is NOT NULL), but writes it with
// consent_source: null — a placeholder, not a decline — so those two other flows
// remain free to make a real, dedicated ask later. The one exception: a Google
// signup that already answered the digest question on the signup page before the
// OAuth redirect (which React state can't survive) — that choice is picked up
// from localStorage here, on this same first-consent-row write, correctly sourced.
export function ConsentGate() {
  const [show, setShow] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
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
        setUserId(user.id)
        setShow(true)
      }
    })
  }, [])

  const handleSubmit = async () => {
    if (!termsAccepted) {
      setError('יש לאשר את תנאי השימוש ומדיניות הפרטיות כדי להמשיך')
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
        setError(data.error || 'שגיאה בשמירת ההסכמה. נסה/י שוב.')
        setSaving(false)
        return
      }

      localStorage.removeItem(PENDING_DIGEST_CONSENT_KEY)
      setShow(false)
    } catch {
      setError('שגיאה בשמירת ההסכמה. נסה/י שוב.')
      setSaving(false)
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-xl max-w-md w-full p-8"
        dir="rtl"
      >
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🌿</div>
          <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
            עדכון תנאי שימוש
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            עדכנו את תנאי השימוש ומדיניות הפרטיות שלנו.
            אנא אשר/י את הסכמתך כדי להמשיך להשתמש ב-Vetree.
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
              קראתי ואני מסכים/ה ל
              <a href="/terms" target="_blank" className="text-[#3D7A5F] dark:text-[#4E9A78] hover:underline">תנאי השימוש</a>
              {' '}ול
              <a href="/privacy" target="_blank" className="text-[#3D7A5F] dark:text-[#4E9A78] hover:underline">מדיניות הפרטיות</a>
              {' '}של Vetree.{' '}
              <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm mb-4 text-center">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving || !termsAccepted}
          className="w-full bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-3 font-medium transition-colors"
        >
          {saving ? 'שומר...' : 'אישור והמשך'}
        </button>
      </div>
    </div>
  )
}
