'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// A failed email link (confirmation / magic link) comes back from Supabase on whatever page it pointed to, with
// ?error=…&error_code=otp_expired (or the same in the hash). Before analytics-001 nothing read it: the reader saw an
// article and no explanation (2026-10-12: a sign-up's first link was replaced by a second email two minutes later).
// /reset-password shows its own message, so it's skipped here.
export function AuthLinkErrorNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (window.location.pathname.startsWith('/reset-password')) return
    const query = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const code = query.get('error_code') || hash.get('error_code')
    const error = query.get('error') || hash.get('error')
    const description = (query.get('error_description') || hash.get('error_description') || '').toLowerCase()
    // Only failed email links — not every provider error (e.g. a cancelled Google sign-in)
    const linkFailed = code === 'otp_expired' || (error === 'access_denied' && description.includes('link'))
    if (!linkFailed) return
    // The URL (incl. the hash) only exists in the browser: read once after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true)

    // Drop only the error params so a reload or a shared URL doesn't repeat the notice; keep anything else
    const keys = ['error', 'error_code', 'error_description']
    const hashHadError = keys.some(k => hash.has(k))
    for (const k of keys) { query.delete(k); hash.delete(k) }
    const q = query.toString()
    // An unrelated fragment (#clinical-summary) is kept verbatim; only an error fragment is rewritten
    const h = hashHadError ? (hash.toString() ? `#${hash.toString()}` : '') : window.location.hash
    // null, not history.state: Next skips its router sync for its own state (__NA), so useSearchParams would keep
    // the error params (the rest of the app passes null too)
    window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : '') + h)
  }, [])

  if (!show) return null

  return (
    <div role="alert" style={{
      // top: the consent banner owns the bottom edge
      position: 'fixed', left: 16, right: 16, top: 16, zIndex: 60, maxWidth: 520, margin: '0 auto',
      background: 'var(--al-card)', border: '1px solid rgba(var(--al-line),.18)', borderRadius: 12,
      padding: '14px 16px', boxShadow: '0 8px 30px rgba(0,0,0,.12)',
      font: "400 14px/1.5 var(--font-instrument, sans-serif)", color: 'var(--al-ink3)',
    }}>
      <p style={{ margin: '0 0 10px' }}>
        That email link didn’t work — it has expired or was already used. If you asked for more than one email, only
        the newest link works.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href="/verify-email" style={{ color: 'var(--al-accent)', fontWeight: 600 }}>Send a new confirmation link</Link>
        <Link href="/login" style={{ color: 'var(--al-accent)', fontWeight: 600 }}>Sign in</Link>
        <button type="button" onClick={() => setShow(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--al-mut2)', font: 'inherit' }}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
