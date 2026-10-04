'use client'

// "Personalize later" (Batch B, 2026-10-03). Signup no longer asks for specialties — they were
// saved to localStorage before verification and never read. Instead, signed-in, verified readers
// who follow nothing see this card at the top of their Stream (app/page.tsx decides who):
// pick specialties → Follow saves them (/api/tags/follow) and the feed personalizes.
// "Not now" hides it for 14 days; after the second "Not now" it never comes back. The choice is
// kept per account (one browser, several accounts) and still applies for this visit when the
// browser refuses storage (private mode, quota). Never blocks the page.
// Events: personalize_card_shown (once per session) / _saved / _save_failed / _snoozed.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'

const SPECIALTIES = [
  'Anesthesia', 'Behavior', 'Cardiology', 'Dentistry', 'Dermatology',
  'Emergency', 'Equine', 'Exotic', 'Internal Medicine', 'Neurology',
  'Nutrition', 'Oncology', 'Ophthalmology', 'Orthopedics', 'Pathology',
  'Pharmacology', 'Radiology', 'Reproduction', 'Soft Tissue Surgery',
]

const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000
const MAX_SNOOZES = 2
const CHANGE_EVENT = 'vetree:personalize-card'

type Stored = { until: number; snoozes: number }
const EMPTY: Stored = { until: 0, snoozes: 0 }

// Dismissals made while storage was unavailable — honoured for the rest of this page's life
const memory = new Map<string, Stored>()
// "Shown" already recorded this page life (fallback when sessionStorage is unavailable)
const shownInMemory = new Set<string>()

const storageKey = (userId: string) => `vetree_personalize_card:${userId}`

function read(key: string): Stored {
  const remembered = memory.get(key)
  if (remembered) return remembered
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null')
    if (v && Number.isFinite(v.until) && Number.isInteger(v.snoozes) && v.snoozes >= 0) return v
  } catch { /* unavailable or corrupt: treat as never dismissed */ }
  return EMPTY
}

function write(key: string, value: Stored) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    memory.delete(key)
  } catch {
    memory.set(key, value)   // storage refused: still dismissed for this visit
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function trackEvent(eventName: string, detail?: Record<string, unknown>) {
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_name: eventName, detail }),
  }).catch(() => {})
}

export function PersonalizeCard({ userId }: { userId: string }) {
  const router = useRouter()
  const key = storageKey(userId)
  // 'ssr' on the server and before hydration (render nothing — no flash), then 'show' / 'hide'
  const getSnapshot = useCallback(() => {
    const s = read(key)
    return s.snoozes >= MAX_SNOOZES || Date.now() < s.until ? 'hide' : 'show'
  }, [key])
  const visibility = useSyncExternalStore(subscribe, getSnapshot, () => 'ssr' as const)

  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'partial' | 'error'>('idle')
  const [result, setResult] = useState({ ok: 0, of: 0 })

  // "Shown" once per browser session, not on every page view
  useEffect(() => {
    if (visibility !== 'show') return
    const flag = `vetree_personalize_shown:${userId}`
    if (shownInMemory.has(flag)) return
    shownInMemory.add(flag)
    try {
      if (sessionStorage.getItem(flag)) return
      sessionStorage.setItem(flag, '1')
    } catch { /* no session storage: the in-memory flag still limits it to once per page life */ }
    trackEvent('personalize_card_shown', { snoozes: read(key).snoozes })
  }, [visibility, key, userId])

  if (visibility !== 'show' && status !== 'saved') return null

  const saving = status === 'saving'
  const toggle = (spec: string) => {
    if (saving) return
    setSelected(prev => (prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]))
  }

  const save = async () => {
    if (selected.length === 0 || saving) return
    const batch = selected
    setStatus('saving')
    const results = await Promise.allSettled(batch.map(tag =>
      fetch('/api/tags/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
      }).then(r => { if (!r.ok) throw new Error(String(r.status)) })
    ))
    const failed = batch.filter((_, i) => results[i].status === 'rejected')
    const ok = batch.length - failed.length
    setResult({ ok, of: batch.length })
    if (ok === 0) {
      trackEvent('personalize_card_save_failed', { selected: batch.length })
      setStatus('error')
      return
    }
    trackEvent('personalize_card_saved', { selected: batch.length, followed: ok })
    if (failed.length > 0) {
      // Keep the picker with only the failed ones selected, so they can be retried
      setSelected(failed)
      setStatus('partial')
      return
    }
    setStatus('saved')
    // The server now sees followed tags: the personalized feed appears and this card goes away
    setTimeout(() => router.refresh(), 1500)
  }

  const notNow = () => {
    if (saving) return
    const s = read(key)
    const next: Stored = { until: Date.now() + SNOOZE_MS, snoozes: s.snoozes + 1 }
    trackEvent('personalize_card_snoozed', { snoozes: next.snoozes })
    write(key, next)
  }

  return (
    <section
      data-testid="personalize-card"
      aria-label="Personalize your Stream"
      style={{
        margin: '8px 0 24px', padding: '20px 22px', borderRadius: 14,
        background: 'rgba(var(--al-acct), .06)', border: '1px solid rgba(var(--al-acct), .22)',
      }}
    >
      {status === 'saved' ? (
        <p role="status" style={{ margin: 0, font: "500 15px/1.5 var(--font-instrument, sans-serif)", color: 'var(--al-ink3)' }}>
          ✓ Following {result.ok} {result.ok === 1 ? 'specialty' : 'specialties'} — your Stream is updating.
        </p>
      ) : (
        <>
          <h2 style={{ margin: '0 0 6px', font: "500 20px/1.3 var(--font-spectral, serif)", color: 'var(--al-ink2)' }}>
            Make your Stream yours
          </h2>
          <p style={{ margin: '0 0 16px', font: "400 14px/1.5 var(--font-instrument, sans-serif)", color: 'var(--al-sub)' }}>
            Follow the specialties you care about — new research in them comes first, and in your weekly digest.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {SPECIALTIES.map(spec => {
              const on = selected.includes(spec)
              return (
                <button
                  key={spec}
                  type="button"
                  aria-pressed={on}
                  disabled={saving}
                  onClick={() => toggle(spec)}
                  style={{
                    padding: '7px 13px', borderRadius: 999, cursor: saving ? 'default' : 'pointer',
                    font: "500 13px/1 var(--font-instrument, sans-serif)",
                    background: on ? 'var(--al-accent)' : 'transparent',
                    color: on ? 'var(--al-on-accent)' : 'var(--al-body)',
                    border: on ? '1px solid var(--al-accent)' : '1px solid rgba(var(--al-line), .18)',
                  }}
                >
                  {spec}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={save}
              disabled={selected.length === 0 || saving}
              data-testid="personalize-save"
              style={{
                padding: '10px 18px', borderRadius: 10, border: 0,
                cursor: selected.length === 0 || saving ? 'not-allowed' : 'pointer',
                opacity: selected.length === 0 ? 0.5 : 1,
                background: 'var(--al-accent)', color: 'var(--al-on-accent)',
                font: "600 14px/1 var(--font-instrument, sans-serif)",
              }}
            >
              {saving ? 'Saving…' : status === 'partial' ? `Retry ${selected.length}` : selected.length > 0 ? `Follow ${selected.length}` : 'Follow'}
            </button>
            <button
              type="button"
              onClick={notNow}
              disabled={saving}
              data-testid="personalize-not-now"
              style={{ background: 'none', border: 0, cursor: saving ? 'default' : 'pointer', padding: '10px 4px', font: "500 14px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut3)' }}
            >
              Not now
            </button>
            {status === 'partial' && (
              <span role="status" style={{ font: "400 13px/1.4 var(--font-instrument, sans-serif)", color: 'var(--al-sub)' }}>
                Following {result.ok} of {result.of}. The rest didn&apos;t save — retry them, or leave it for now.
              </span>
            )}
            {status === 'error' && (
              <span role="alert" style={{ font: "400 13px/1.4 var(--font-instrument, sans-serif)", color: '#D9534F' }}>
                Couldn&apos;t save — please try again.
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}

/** Exported for scripts/test-personalize-card.mts only */
export const _storageForTests = { read, write, storageKey, SNOOZE_MS, MAX_SNOOZES }
