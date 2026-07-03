'use client'

import Link from 'next/link'
import { Article } from '@/lib/supabase'
import { useSavedArticles } from '@/lib/hooks/useSavedArticles'
import { useAuth } from '@/lib/hooks/useAuth'
import { getLabelHue } from '@/lib/constants/labelColors'

const LARGE_ANIMAL = [
  'Equine', 'equine', 'Large Animal', 'large animal',
  'Livestock', 'livestock', 'Poultry', 'poultry',
  'Food Animal', 'food animal',
]

const SPECIES = [
  'Small Animal', 'Large Animal', 'small animal', 'large animal',
  'Equine', 'equine', 'Livestock', 'livestock', 'Poultry', 'poultry',
  'Food Animal', 'food animal', 'Feline', 'feline', 'Canine', 'canine', 'Exotic',
]

type Props = {
  article: Article
}

export function ArticleMobileHero({ article }: Props) {
  const { user } = useAuth()
  const { isSaved, toggleSave } = useSavedArticles()

  const filteredLabels = article.labels?.filter(l => !LARGE_ANIMAL.includes(l)) ?? []
  const primaryLabel = article.labels?.filter(l => !SPECIES.includes(l))[0]

  const saved = isSaved(article.id)

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', minHeight: 50, borderRadius: 13, padding: '0 18px',
    fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 14, fontWeight: 600,
    lineHeight: 1, cursor: 'pointer', border: 'none', textDecoration: 'none',
    transition: 'opacity .15s ease',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Journal + date */}
      <p style={{
        margin: 0,
        fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 12, fontWeight: 400,
        color: 'var(--al-mut4)', lineHeight: 1,
      }}>
        {article.source_journal}
        {article.publication_date && (
          <> &middot; {new Date(article.publication_date).getFullYear()}</>
        )}
      </p>

      {/* Label chips */}
      {filteredLabels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {filteredLabels.map(label => {
            const hue = getLabelHue(label)
            return (
              <span
                key={label}
                className="al-chip"
                style={{ '--chip-h': hue } as React.CSSProperties}
              >
                {label}
              </span>
            )
          })}
        </div>
      )}

      {/* CBL */}
      {article.clinical_bottom_line && (
        <div style={{
          background: 'var(--al-card)',
          borderLeft: '3px solid var(--al-accent)',
          borderRadius: '0 10px 10px 0',
          padding: '14px 16px',
        }}>
          <div style={{
            fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 9.5, fontWeight: 700,
            letterSpacing: '.14em', textTransform: 'uppercase',
            color: 'var(--al-accent)', marginBottom: 8, lineHeight: 1,
          }}>
            Bottom line
          </div>
          <p style={{
            margin: 0,
            fontFamily: 'var(--font-spectral, serif)', fontStyle: 'italic',
            fontSize: 16, fontWeight: 500, lineHeight: 1.45,
            color: 'var(--al-ink2)',
          }}>
            {article.clinical_bottom_line}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {/* Synthesis button */}
        {primaryLabel && (
          <Link
            href={`/?search=${encodeURIComponent(primaryLabel)}&synthesize=true`}
            style={{ ...btnBase, background: 'var(--al-accent)', color: 'var(--al-on-accent)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
            See synthesis for {primaryLabel}
          </Link>
        )}

        {/* Save button */}
        {user ? (
          <button
            onClick={() => toggleSave(article.id)}
            style={{
              ...btnBase,
              background: saved ? 'rgba(var(--al-acct, 95,140,51), .12)' : 'var(--al-card)',
              border: saved ? '1px solid var(--al-accent)' : '1px solid rgba(var(--al-line, 232,224,204), .15)',
              color: saved ? 'var(--al-accent)' : 'var(--al-sub)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24"
              fill={saved ? 'var(--al-accent)' : 'none'}
              stroke={saved ? 'var(--al-accent)' : 'currentColor'}
              strokeWidth="1.8"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14v18l-7-5-7 5V3z" />
            </svg>
            {saved ? 'Saved' : 'Save article'}
          </button>
        ) : (
          <Link
            href={`/signup?return=/article/${article.id}`}
            style={{ ...btnBase, background: 'var(--al-accent)', color: 'var(--al-on-accent)' }}
          >
            Sign up free to save articles
          </Link>
        )}

        {/* Read full paper */}
        {article.article_url && (
          <a
            href={article.article_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...btnBase,
              background: 'var(--al-card)',
              border: '1px solid rgba(var(--al-line, 232,224,204), .15)',
              color: 'var(--al-sub)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Read full paper
          </a>
        )}
      </div>
    </div>
  )
}
