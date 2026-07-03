'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Article } from '@/lib/supabase'
import { getLabelHue } from '@/lib/constants/labelColors'
import { getEvidenceLevel, getEvidenceBadgeProps } from '@/lib/utils/evidenceBadge'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSavedArticles } from '@/lib/hooks/useSavedArticles'

function parseLabels(labels: string[] | null | undefined): string[] {
  if (!labels || !Array.isArray(labels)) return []
  const result: string[] = []
  for (const label of labels) {
    if (typeof label === 'string') {
      const cleaned = label.replace(/[\[\]"\\]/g, '').trim()
      if (cleaned) result.push(...cleaned.split(',').map(l => l.trim()).filter(Boolean))
    }
  }
  return result
}

// Row separator style
const rowStyle: React.CSSProperties = {
  padding: '30px 0',
  borderTop: '1px solid rgba(var(--al-line, 232,224,204), .08)',
}

export function StreamRow({ article }: { article: Article }) {
  const [expanded, setExpanded] = useState(false)
  const [summary, setSummary] = useState<string | null>(article.summary ?? null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { user } = useAuth()
  const { isSaved, toggleSave } = useSavedArticles()
  const saved = user ? isSaved(article.id) : false

  const cleanLabels = parseLabels(article.labels)
  const specialty = cleanLabels[0] || ''
  const specialtyHue = getLabelHue(specialty)

  const level = getEvidenceLevel(article.strength_of_evidence, cleanLabels)
  const { label: evLabel, hue: evHue, dot: evDot, tooltip: evTooltip } = getEvidenceBadgeProps(level)

  const firstAuthor = (article.authors || '').split(',')[0]?.trim() || ''
  const bylineAuthor = firstAuthor ? `${firstAuthor}, et al.` : ''
  const journal = article.source_journal || ''
  const date = article.publication_date
    ? new Date(article.publication_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''
  const bylineParts = [bylineAuthor, [journal, date].filter(Boolean).join(', ')].filter(Boolean)
  const byline = bylineParts.join(' · ')

  const handleExpand = async () => {
    if (!expanded && !summary) {
      setLoadingSummary(true)
      try {
        const res = await fetch(`/api/articles/${article.id}/summary`)
        const data = await res.json()
        if (data.summary) setSummary(data.summary)
      } finally {
        setLoadingSummary(false)
      }
    }
    setExpanded(e => !e)
  }

  const handleSave = async () => {
    if (!user) return
    setIsSaving(true)
    await toggleSave(article.id)
    setIsSaving(false)
  }

  return (
    <div style={rowStyle}>
      {/* Chips row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 15 }}>
        {specialty && (
          <>
            <span
              className="al-spec-text"
              style={{ '--chip-h': specialtyHue } as React.CSSProperties}
            >
              {specialty}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--al-mut7)', display: 'inline-block', flexShrink: 0 }} />
          </>
        )}
        <span
          className="al-ev-chip"
          style={{ '--ev-h': evHue, '--ev-dot': evDot } as React.CSSProperties}
          title={evTooltip}
        >
          <span className="al-ev-dot" />
          {evLabel}
        </span>
      </div>

      {/* Bottom line */}
      {article.clinical_bottom_line && (
        <p style={{
          margin: '0 0 12px',
          fontFamily: 'var(--font-spectral, serif)',
          fontSize: 25,
          fontWeight: 500,
          lineHeight: 1.42,
          color: 'var(--al-ink2)',
          letterSpacing: '-.008em',
        }}>
          {article.clinical_bottom_line}
        </p>
      )}

      {/* Paper row */}
      <Link
        href={`/article/${article.id}`}
        style={{ display: 'flex', gap: 10, marginBottom: 15, textDecoration: 'none' }}
      >
        <span style={{
          flexShrink: 0,
          fontFamily: 'var(--font-instrument, sans-serif)',
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1.8,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--al-mut6)',
        }}>
          Paper
        </span>
        <span style={{
          fontFamily: 'var(--font-spectral, serif)',
          fontSize: 15,
          fontWeight: 500,
          lineHeight: 1.45,
          color: 'var(--al-mut1)',
        }}>
          {article.title}
        </span>
      </Link>

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--font-spectral, serif)',
          fontStyle: 'italic',
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.4,
          color: 'var(--al-mut2)',
        }}>
          {byline}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button
            onClick={handleExpand}
            disabled={loadingSummary}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontFamily: 'var(--font-instrument, sans-serif)',
              fontSize: 13, fontWeight: 600, lineHeight: 1,
              color: 'var(--al-accent)', cursor: 'pointer',
            }}
          >
            {loadingSummary ? 'Loading…' : expanded ? 'Hide summary' : 'Expand summary ›'}
          </button>

          {/* Share icon */}
          <span style={{ display: 'flex', alignItems: 'center', color: 'var(--al-mut4)', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="18" cy="5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="18" cy="19" r="2.5" />
              <path strokeLinecap="round" d="M15.7 6.3l-7.4 4.4M8.3 13.3l7.4 4.4" />
            </svg>
          </span>

          {/* Bookmark */}
          {user && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              aria-label={saved ? 'Remove from library' : 'Save to library'}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', opacity: isSaving ? 0.5 : 1 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24"
                fill={saved ? 'var(--al-accent)' : 'none'}
                stroke={saved ? 'var(--al-accent)' : 'var(--al-mut4)'}
                strokeWidth="1.8"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14v18l-7-5-7 5V3z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded summary panel */}
      {expanded && (
        <div style={{
          marginTop: 18,
          padding: '18px 20px',
          background: 'var(--al-card)',
          border: '1px solid rgba(var(--al-line, 232,224,204), .09)',
          borderRadius: 13,
        }}>
          <div style={{
            fontFamily: 'var(--font-instrument, sans-serif)',
            fontSize: 10, fontWeight: 600, lineHeight: 1,
            letterSpacing: '.14em', textTransform: 'uppercase',
            color: 'var(--al-accent)', marginBottom: 10,
          }}>
            Summary
          </div>
          {summary ? (
            <>
              <p style={{
                margin: '0 0 14px',
                fontFamily: 'var(--font-instrument, sans-serif)',
                fontSize: 14, fontWeight: 400, lineHeight: 1.65,
                color: 'var(--al-mut1)',
              }}>
                {summary}
              </p>
              <Link
                href={`/article/${article.id}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  fontFamily: 'var(--font-instrument, sans-serif)',
                  fontSize: 13, fontWeight: 600, lineHeight: 1,
                  color: 'var(--al-accent)', textDecoration: 'none',
                }}
              >
                Read full article
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </>
          ) : (
            <p style={{
              margin: 0,
              fontFamily: 'var(--font-spectral, serif)',
              fontStyle: 'italic', fontSize: 14, fontWeight: 400, lineHeight: 1.65,
              color: 'var(--al-mut3)',
            }}>
              No summary available.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
