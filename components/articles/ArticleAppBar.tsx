'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSavedArticles } from '@/lib/hooks/useSavedArticles'

type ArticleAppBarProps = {
  articleId: string
  articleUrl?: string | null
  articleTitle?: string
}

export function ArticleAppBar({ articleId, articleUrl, articleTitle }: ArticleAppBarProps) {
  const { user } = useAuth()
  const { isSaved, toggleSave } = useSavedArticles()
  const saved = isSaved(articleId)

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : null

  const handleShare = () => {
    if (navigator.share && articleTitle) {
      navigator.share({ title: articleTitle, url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
    }
  }

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: 'rgba(var(--al-bar),0.86)',
      backdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(var(--al-line),0.1)',
    }}>
      <div style={{
        maxWidth: 1040, margin: '0 auto', padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Link
            href="/"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              color: 'var(--al-mut3)', font: "500 13.5px/1 var(--font-instrument, sans-serif)",
              textDecoration: 'none',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6"/>
            </svg>
            Stream
          </Link>
          <span style={{ width: 1, height: 20, background: 'rgba(var(--al-line),0.15)' }} />
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--al-accent)">
              <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
            </svg>
            <span style={{ font: "600 18px/1 var(--font-spectral, serif)", color: 'var(--al-ink2)' }}>Vetree</span>
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Save button */}
          <button
            onClick={() => user && toggleSave(articleId)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              height: 38, padding: '0 15px', borderRadius: 10, cursor: 'pointer',
              font: "600 13px/1 var(--font-instrument, sans-serif)",
              transition: 'all .15s',
              background: saved ? 'rgba(var(--al-acct),0.12)' : 'var(--al-card)',
              border: saved ? '1px solid var(--al-accent)' : '1px solid rgba(var(--al-line),0.12)',
              color: saved ? 'var(--al-accent)' : 'var(--al-mut3)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24"
              fill={saved ? 'var(--al-accent)' : 'none'}
              stroke={saved ? 'var(--al-accent)' : 'var(--al-mut3)'}
              strokeWidth="1.8"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14v18l-7-5-7 5V3z"/>
            </svg>
            {saved ? 'Saved' : 'Save'}
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            title="Share"
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'var(--al-card)', border: '1px solid rgba(var(--al-line),0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--al-mut3)', cursor: 'pointer',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="18" cy="5" r="2.5"/>
              <circle cx="6" cy="12" r="2.5"/>
              <circle cx="18" cy="19" r="2.5"/>
              <path strokeLinecap="round" d="M15.7 6.3l-7.4 4.4M8.3 13.3l7.4 4.4"/>
            </svg>
          </button>

          {/* Avatar or sign-in */}
          {initials ? (
            <Link href="/profile" style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--al-accent)', color: 'var(--al-onaccent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              font: "600 12.5px/1 var(--font-instrument, sans-serif)",
              textDecoration: 'none',
            }}>
              {initials}
            </Link>
          ) : (
            <Link href="/auth/signin" style={{
              height: 34, padding: '0 14px', borderRadius: 8,
              background: 'var(--al-card)', border: '1px solid rgba(var(--al-line),0.12)',
              display: 'flex', alignItems: 'center',
              font: "500 13px/1 var(--font-instrument, sans-serif)",
              color: 'var(--al-mut2)', textDecoration: 'none',
            }}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
