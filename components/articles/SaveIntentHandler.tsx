'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSavedArticles } from '@/lib/hooks/useSavedArticles'
import Link from 'next/link'

type RelatedArticle = {
  id: string
  clinical_bottom_line: string | null
  source_journal: string | null
  labels: string[] | null
}

type Props = {
  articleId: string
  relatedArticles: RelatedArticle[]
}

function trackEvent(eventName: string, articleId?: string) {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_name: eventName, article_id: articleId }),
  }).catch(() => {})
}

// ── First-save shelf ────────────────────────────────────────────────────────

function FirstSaveShelf({
  relatedArticles,
  onDismiss,
  toggleSave,
  isSaved,
}: {
  relatedArticles: RelatedArticle[]
  onDismiss: () => void
  toggleSave: (id: string) => Promise<{ error?: string } | undefined>
  isSaved: (id: string) => boolean
}) {
  const [saving, setSaving] = useState<string | null>(null)

  const handleSave = async (id: string) => {
    setSaving(id)
    await toggleSave(id)
    setSaving(null)
  }

  return (
    <div
      data-testid="first-save-shelf"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          background: 'var(--al-bg)', borderRadius: '20px 20px 0 0',
          padding: '28px 24px 48px', width: '100%', maxWidth: 500,
          boxShadow: '0 -8px 32px rgba(0,0,0,.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(var(--al-line,62,54,36),.2)', margin: '0 auto 24px' }} />

        {/* Bookmark icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--al-accent)">
            <path d="M5 3h14v18l-7-5-7 5V3z"/>
          </svg>
        </div>

        <h2 style={{
          margin: '0 0 8px', textAlign: 'center', direction: 'rtl',
          font: '600 19px/1.3 var(--font-spectral, serif)', color: 'var(--al-ink2)',
        }}>
          הספרייה שלך מתחילה כאן
        </h2>
        <p style={{
          margin: '0 0 24px', textAlign: 'center', direction: 'rtl',
          font: '400 13.5px/1.6 var(--font-instrument, sans-serif)', color: 'var(--al-mut3)',
        }}>
          שמרו עוד מאמרים לספרייה שלכם — תמצאו אותם בדיוק כשתזדקקו להם
        </p>

        {/* Related articles */}
        {relatedArticles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {relatedArticles.map(rel => (
              <div key={rel.id} style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                background: 'var(--al-card)', border: '1px solid rgba(var(--al-line,62,54,36),.1)',
                borderRadius: 12, padding: '12px 14px',
              }}>
                <p style={{
                  margin: 0, flex: 1, minWidth: 0,
                  font: '400 13px/1.5 var(--font-instrument, sans-serif)', color: 'var(--al-ink3)',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {rel.clinical_bottom_line || rel.source_journal || rel.id}
                </p>
                <button
                  onClick={() => handleSave(rel.id)}
                  disabled={saving === rel.id}
                  style={{
                    flexShrink: 0, width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: isSaved(rel.id) ? 'rgba(var(--al-acct),.12)' : 'rgba(var(--al-line,62,54,36),.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24"
                    fill={isSaved(rel.id) ? 'var(--al-accent)' : 'none'}
                    stroke={isSaved(rel.id) ? 'var(--al-accent)' : 'var(--al-mut4)'}
                    strokeWidth="1.8"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14v18l-7-5-7 5V3z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/library" style={{
            flex: 1, display: 'block', textAlign: 'center',
            padding: '13px', background: 'var(--al-accent)', color: '#fff',
            borderRadius: 11, textDecoration: 'none',
            font: '600 14px/1 var(--font-instrument, sans-serif)',
          }}>
            לספרייה שלי ←
          </Link>
          <button onClick={onDismiss} style={{
            padding: '13px 18px', background: 'rgba(var(--al-line,62,54,36),.07)',
            border: 'none', borderRadius: 11, cursor: 'pointer',
            font: '500 14px/1 var(--font-instrument, sans-serif)', color: 'var(--al-mut3)',
          }}>
            סגור
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Auth prompt ─────────────────────────────────────────────────────────────

function SaveAuthPrompt({
  articleId,
  onDismiss,
}: {
  articleId: string
  onDismiss: () => void
}) {
  const returnUrl = encodeURIComponent(`/article/${articleId}?intent=save`)

  return (
    <div
      data-testid="save-auth-prompt"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          background: 'var(--al-bg)', borderRadius: '20px 20px 0 0',
          padding: '28px 24px 48px', width: '100%', maxWidth: 500,
          boxShadow: '0 -8px 32px rgba(0,0,0,.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(var(--al-line,62,54,36),.2)', margin: '0 auto 24px' }} />

        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="var(--al-accent)">
            <path d="M5 3h14v18l-7-5-7 5V3z"/>
          </svg>
        </div>

        <h2 style={{
          margin: '0 0 10px', textAlign: 'center', direction: 'rtl',
          font: '600 20px/1.3 var(--font-spectral, serif)', color: 'var(--al-ink2)',
        }}>
          התחברו כדי לשמור את המאמר בספרייה שלכם
        </h2>
        <p style={{
          margin: '0 0 28px', textAlign: 'center', direction: 'rtl',
          font: '400 14px/1.6 var(--font-instrument, sans-serif)', color: 'var(--al-mut3)',
        }}>
          הספרייה שלכם שומרת מאמרים — תמצאו אותם בדיוק כשתצטרכו אותם, במהלך תור, בניתוח, בכל מקום
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href={`/signup?return=${returnUrl}`}
            style={{
              display: 'block', textAlign: 'center',
              padding: '14px', background: 'var(--al-accent)', color: '#fff',
              borderRadius: 12, textDecoration: 'none',
              font: '600 15px/1 var(--font-instrument, sans-serif)',
            }}
          >
            הצטרפו בחינם
          </a>
          <a
            href={`/login?return=${returnUrl}`}
            style={{
              display: 'block', textAlign: 'center',
              padding: '14px',
              background: 'var(--al-card)', color: 'var(--al-ink3)',
              border: '1px solid rgba(var(--al-line,62,54,36),.15)',
              borderRadius: 12, textDecoration: 'none',
              font: '500 15px/1 var(--font-instrument, sans-serif)',
            }}
          >
            כבר יש לי חשבון
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Main handler ────────────────────────────────────────────────────────────

export function SaveIntentHandler({ articleId, relatedArticles }: Props) {
  const { user, loading: authLoading } = useAuth()
  const { isSaved, toggleSave, savedArticleIds, loading: saveLoading } = useSavedArticles()
  const [toast, setToast] = useState<{
    message: string
    showUndo?: boolean
    showLibrary?: boolean
  } | null>(null)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [showFirstSave, setShowFirstSave] = useState(false)
  const handled = useRef(false)

  useEffect(() => {
    if (authLoading || saveLoading) return
    if (handled.current) return

    const params = new URLSearchParams(window.location.search)
    if (params.get('intent') !== 'save') return

    handled.current = true

    // Strip intent=save from URL immediately so refresh doesn't re-trigger
    params.delete('intent')
    const newSearch = params.toString()
    history.replaceState(null, '', window.location.pathname + (newSearch ? '?' + newSearch : ''))

    trackEvent('save_intent_arrived', articleId)

    if (!user) {
      trackEvent('save_intent_auth_shown', articleId)
      setShowAuthPrompt(true)
      return
    }

    if (isSaved(articleId)) {
      setToast({ message: 'כבר בספרייה שלך', showLibrary: true })
      setTimeout(() => setToast(null), 4500)
      return
    }

    // Capture before save so we can detect first save
    const isFirstSave = savedArticleIds.size === 0

    // Check localStorage so shelf only ever shows once
    const shelfShown = localStorage.getItem('vetree_first_save_shelf_shown')

    toggleSave(articleId).then(result => {
      if (!result?.error) {
        trackEvent('save_intent_completed', articleId)
        if (isFirstSave && !shelfShown && relatedArticles.length > 0) {
          localStorage.setItem('vetree_first_save_shelf_shown', '1')
          setShowFirstSave(true)
        } else {
          setToast({ message: 'נשמר לספרייה שלך ✓', showUndo: true })
          setTimeout(() => setToast(null), 5000)
        }
      }
    })
  }, [authLoading, saveLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUndo = async () => {
    setToast(null)
    await toggleSave(articleId)
  }

  if (!toast && !showAuthPrompt && !showFirstSave) return null

  return (
    <>
      {/* Toast */}
      {toast && (
        <div data-testid="save-toast" style={{
          position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--al-ink2)', color: 'var(--al-bg)',
          padding: '12px 20px', borderRadius: 10,
          font: '500 14px/1 var(--font-instrument, sans-serif)',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,.22)',
          zIndex: 100, whiteSpace: 'nowrap',
        }}>
          {toast.message}
          {toast.showUndo && (
            <button onClick={handleUndo} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: '#6ee7b7', font: '600 13px/1 var(--font-instrument, sans-serif)',
            }}>
              Undo
            </button>
          )}
          {toast.showLibrary && (
            <Link href="/library" style={{
              color: '#6ee7b7', font: '600 13px/1 var(--font-instrument, sans-serif)',
              textDecoration: 'none',
            }}>
              לספרייה ←
            </Link>
          )}
        </div>
      )}

      {showAuthPrompt && (
        <SaveAuthPrompt articleId={articleId} onDismiss={() => setShowAuthPrompt(false)} />
      )}

      {showFirstSave && (
        <FirstSaveShelf
          relatedArticles={relatedArticles}
          onDismiss={() => setShowFirstSave(false)}
          toggleSave={toggleSave}
          isSaved={isSaved}
        />
      )}
    </>
  )
}
