'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSavedArticles } from '@/lib/hooks/useSavedArticles'
import { requestGuestSave } from '@/lib/saveIntent'

// The inline save under the clinical bottom line (seo-002, Roi 2026-11-23). Google readers land on one article, read
// the bottom line and leave (710 landings → 2% opened a 2nd page, 1 signup); the app bar's Save is a small icon on
// phones. Guests enter the same save-intent flow as the app bar (tagged placement 'inline'); signed-in readers save
// directly. The 3-article wall is unchanged. isLoggedIn comes from the server so a guest's first paint is final.
export function InlineSave({ articleId, isLoggedIn }: { articleId: string; isLoggedIn: boolean }) {
  const { user, loading } = useAuth()
  const { isSaved, toggleSave, loading: savedLoading } = useSavedArticles()
  const signedIn = loading ? isLoggedIn : !!user
  const saved = signedIn && isSaved(articleId)

  const onSave = () => {
    if (signedIn && user) void toggleSave(articleId)
    else requestGuestSave(articleId, { onArticlePage: true, placement: 'inline' })
  }

  return (
    <div
      data-testid="inline-save"
      style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        background: 'var(--al-card)', border: '1px solid rgba(var(--al-line),0.12)',
        borderRadius: 14, padding: '14px 16px', margin: '-22px 0 38px',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}
        fill={saved ? 'var(--al-accent)' : 'none'} stroke="var(--al-accent)" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14v18l-7-5-7 5V3z" />
      </svg>
      <p style={{
        margin: 0, flex: '1 1 220px', minWidth: 0,
        font: '400 14px/1.45 var(--font-instrument, sans-serif)', color: 'var(--al-body)',
      }}>
        {saved
          ? 'Saved to your library.'
          : signedIn
            ? 'Keep this bottom line in your library for your next case.'
            : <>Keep this bottom line for your next case. <span style={{ color: 'var(--al-mut3)' }}>A free library — on your phone and at the clinic.</span></>}
      </p>
      {saved ? (
        <Link href="/library" data-testid="inline-save-library" style={{
          font: '600 13.5px/1 var(--font-instrument, sans-serif)', color: 'var(--al-accent)', textDecoration: 'none',
        }}>
          Open library →
        </Link>
      ) : (
        <button
          type="button"
          onClick={onSave}
          disabled={signedIn && savedLoading}
          data-testid="inline-save-button"
          style={{
            flexShrink: 0, height: 38, padding: '0 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'var(--al-accent)', color: 'var(--al-onaccent)',
            font: '600 13.5px/1 var(--font-instrument, sans-serif)',
          }}
        >
          {signedIn ? 'Save' : 'Save — free'}
        </button>
      )}
    </div>
  )
}
