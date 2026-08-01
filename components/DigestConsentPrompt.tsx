'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DigestConsentQuestion } from '@/components/DigestConsentQuestion'

const STATE_KEY = 'vetree_digest_prompt_state'
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const MAX_SHOWS = 2

type PromptState = { count: number; lastShownAt: string }

function readState(): PromptState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return { count: 0, lastShownAt: '' }
    const parsed = JSON.parse(raw)
    return { count: parsed.count ?? 0, lastShownAt: parsed.lastShownAt ?? '' }
  } catch {
    return { count: 0, lastShownAt: '' }
  }
}

function writeState(state: PromptState) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state))
}

function shouldShowNow(state: PromptState): boolean {
  if (state.count === 0) return true
  if (state.count >= MAX_SHOWS) return false
  const elapsed = Date.now() - new Date(state.lastShownAt).getTime()
  return elapsed >= THIRTY_DAYS_MS
}

// One-time (well, up-to-twice) dismissible ask for users who passed the mandatory
// terms gate (ConsentGate) but were never given a dedicated digest ask — i.e. they
// have a consent row, but none of their rows carries a non-null consent_source and
// none opted in. Users with ANY genuinely-asked row (any source) are excluded,
// including a prior "No" from this same prompt — never re-ask an explicit decline.
// Bottom-sheet chrome matches the existing SaveIntentHandler pattern (mobile is
// ~74% of traffic; this presentation works fine on desktop too).
export function DigestConsentPrompt() {
  const [userId, setUserId] = useState<string | null>(null)
  const [show, setShow] = useState(false)
  const [choice, setChoice] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return

      const state = readState()
      if (!shouldShowNow(state)) return

      const { data: rows } = await supabase
        .from('user_consents')
        .select('marketing_opted_in, consent_source')
        .eq('user_id', user.id)

      if (!rows || rows.length === 0) return // zero rows = ConsentGate's moment, not this prompt's
      const hasTrue = rows.some(r => r.marketing_opted_in === true)
      const hasBeenAsked = rows.some(r => r.consent_source != null)
      if (hasTrue || hasBeenAsked) return

      setUserId(user.id)
      setShow(true)
      writeState({ count: state.count + 1, lastShownAt: new Date().toISOString() })
    })
  }, [])

  const submit = async (value: boolean) => {
    if (!userId || saving) return
    setSaving(true)
    try {
      await fetch('/api/auth/save-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          termsAccepted: true, // already true — this user passed ConsentGate to be here
          marketingOptIn: value,
          consentSource: 'in_app_prompt',
        }),
      })
    } catch {
      // best-effort; if it failed, the row still won't exist, so eligibility
      // naturally re-evaluates (subject to the same show-count cap) next time
    }
    setSaving(false)
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      data-testid="digest-consent-prompt"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={() => setShow(false)}
    >
      <div
        style={{
          background: 'var(--al-bg)', borderRadius: '20px 20px 0 0',
          padding: '28px 24px 40px', width: '100%', maxWidth: 500,
          boxShadow: '0 -8px 32px rgba(0,0,0,.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(var(--al-line,62,54,36),.2)', margin: '0 auto 22px' }} />

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--al-accent)">
            <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
          </svg>
        </div>

        <DigestConsentQuestion value={choice} onChange={value => { setChoice(value); submit(value) }} />

        <button
          onClick={() => setShow(false)}
          disabled={saving}
          style={{
            width: '100%', marginTop: 12, padding: '10px', background: 'none', border: 'none',
            cursor: 'pointer', font: "500 13px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)',
          }}
        >
          Ask me later
        </button>
      </div>
    </div>
  )
}
