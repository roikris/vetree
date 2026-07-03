'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { normalizeQuery } from '@/lib/utils/normalizeQuery'

type SynthesisPanelProps = {
  query: string
  onClose?: () => void
  isLoggedIn?: boolean
}

type StudyBreakdown = {
  systematic_reviews: number
  rct: number
  retrospective: number
  case_reports: number
  total: number
}

type ArticlePacket = {
  citation_id: number
  id: string
  title: string
  journal: string
  year: number
  clinical_bottom_line: string
  labels: string
}

type SynthesisData = {
  synthesis_html: string | null
  synthesis_text?: string
  article_ids?: string[]
  articles?: ArticlePacket[]
  study_type_breakdown?: StudyBreakdown
  from_cache?: boolean
  model_used?: string
  generation_time_ms?: number
  cache_hits?: number
  insufficient?: boolean
  message?: string
}

export function SynthesisPanel({ query, onClose, isLoggedIn }: SynthesisPanelProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SynthesisData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [showFeedbackNote, setShowFeedbackNote] = useState(false)
  const [feedbackNote, setFeedbackNote] = useState('')
  const [showSources, setShowSources] = useState(false)

  const SYNTHESIS_KEY = `vetree_synthesis_${normalizeQuery(query)}`

  useEffect(() => {
    const saved = sessionStorage.getItem(SYNTHESIS_KEY)
    if (saved) {
      try {
        const savedData = JSON.parse(saved)
        setData(savedData)
        setLoading(false)
        return
      } catch (e) {
        console.error('[SynthesisPanel] Failed to parse saved data:', e)
      }
    }

    async function fetchSynthesis() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/synthesis/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to generate synthesis')
        }
        const result = await response.json()
        setData(result)
        sessionStorage.setItem(SYNTHESIS_KEY, JSON.stringify(result))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    if (query && query.trim().length >= 3) {
      fetchSynthesis()
    }
  }, [query, SYNTHESIS_KEY])

  const submitFeedback = async (feedback: 'helpful' | 'not_relevant') => {
    try {
      await fetch('/api/synthesis/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, feedback, feedback_note: feedbackNote || null })
      })
      setFeedbackSubmitted(true)
      setShowFeedbackNote(false)
      setTimeout(() => setFeedbackSubmitted(false), 3000)
    } catch (err) {
      console.error('Failed to submit feedback:', err)
    }
  }

  const handleNotRelevant = () => setShowFeedbackNote(true)
  const handleSubmitNote = () => submitFeedback('not_relevant')

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style>{`@keyframes synthPulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.45 } }`}</style>
        <div style={{
          background: 'var(--al-card2)',
          border: '1px solid rgba(var(--al-line), 0.09)',
          borderRadius: 14,
          padding: '24px 22px',
          marginBottom: 32,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--al-mut6)', flexShrink: 0 }}>
              <path d="M9 3h6M9 3v7l-5 9a1 1 0 0 0 .9 1.5h14.2A1 1 0 0 0 20 19l-5-9V3"/>
              <path d="M6.5 15.5h11"/>
            </svg>
            <span style={{ font: "500 13.5px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)' }}>
              Synthesizing evidence…
            </span>
          </div>
          {([200, '100%', '80%', '60%'] as const).map((w, i) => (
            <div key={i} style={{
              height: i === 0 ? 16 : 13,
              width: w,
              maxWidth: '100%',
              background: 'rgba(var(--al-line), 0.10)',
              borderRadius: 5,
              marginBottom: 10,
              animation: 'synthPulse 1.8s ease-in-out infinite',
              animationDelay: `${i * 0.12}s`,
            }} />
          ))}
        </div>
      </>
    )
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        background: 'rgba(176, 80, 40, 0.06)',
        border: '1px solid rgba(176, 80, 40, 0.15)',
        borderRadius: 14,
        padding: '20px 22px',
        marginBottom: 32,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgb(176,80,40)', flexShrink: 0, marginTop: 2 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <h3 style={{ margin: '0 0 5px', font: "600 15px/1.3 var(--font-spectral, serif)", color: 'var(--al-ink3)' }}>
            Failed to generate synthesis
          </h3>
          <p style={{ margin: 0, font: "400 13px/1.5 var(--font-instrument, sans-serif)", color: 'var(--al-sub)' }}>
            {error}
          </p>
        </div>
      </div>
    )
  }

  // ─── Insufficient studies ─────────────────────────────────────────────────
  if (data?.insufficient) {
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        background: 'rgba(var(--al-warnc), 0.07)',
        border: '1px solid rgba(var(--al-warnc), 0.15)',
        borderRadius: 14,
        padding: '20px 22px',
        marginBottom: 32,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--al-warntext)', flexShrink: 0, marginTop: 2 }}>
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
        </svg>
        <div>
          <h3 style={{ margin: '0 0 5px', font: "600 15px/1.3 var(--font-spectral, serif)", color: 'var(--al-warntext)' }}>
            Not enough studies for synthesis
          </h3>
          <p style={{ margin: 0, font: "400 13px/1.5 var(--font-instrument, sans-serif)", color: 'var(--al-sub)' }}>
            {data.message || 'Not enough studies found for a reliable synthesis on this topic. Try searching with 1-2 broader keywords.'}
          </p>
        </div>
      </div>
    )
  }

  // ─── No synthesis ─────────────────────────────────────────────────────────
  if (!data || !data.synthesis_html) {
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        background: 'var(--al-card2)',
        border: '1px solid rgba(var(--al-line), 0.10)',
        borderRadius: 14,
        padding: '20px 22px',
        marginBottom: 32,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--al-mut6)', flexShrink: 0, marginTop: 2 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <div>
          <h3 style={{ margin: '0 0 5px', font: "600 15px/1.3 var(--font-spectral, serif)", color: 'var(--al-ink3)' }}>
            No synthesis available
          </h3>
          <p style={{ margin: 0, font: "400 13px/1.5 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)' }}>
            Not enough matching studies found for this query. Try a broader search term.
          </p>
        </div>
      </div>
    )
  }

  const breakdown = data.study_type_breakdown || { systematic_reviews: 0, rct: 0, retrospective: 0, case_reports: 0, total: 0 }
  const hasConflictingEvidence = data.synthesis_html.toLowerCase().includes('conflicting evidence')

  const synthesisText = data.synthesis_html.replace(/<a[^>]*>(\[(\d+)\])<\/a>/g, '[$2]')
  const synthesisArticles = data.articles || []

  const CitationLink = (props: any) => {
    const { href, children } = props
    const citationMatch = children?.toString().match(/\[(\d+)\]/)
    if (citationMatch) {
      const citationId = parseInt(citationMatch[1])
      const article = synthesisArticles.find(a => a.citation_id === citationId)
      if (article) {
        return (
          <a
            href={`/article/${article.id}`}
            style={{ color: 'var(--al-accent)', textDecoration: 'underline', textUnderlineOffset: '2px', fontWeight: 500 }}
            title={article.title}
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        )
      }
    }
    return (
      <a href={href} style={{ color: 'var(--al-accent)', textDecoration: 'underline', textUnderlineOffset: '2px' }} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }

  // ─── Main panel ───────────────────────────────────────────────────────────
  return (
    <div style={{
      background: 'var(--al-card)',
      border: '1px solid rgba(var(--al-line), 0.12)',
      borderRadius: 14,
      marginBottom: 32,
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(62,54,36, 0.06)',
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '18px 22px',
        background: 'var(--al-card2)',
        borderBottom: expanded ? '1px solid rgba(var(--al-line), 0.10)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Layers icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--al-accent)', flexShrink: 0 }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
          <h2 style={{ margin: 0, font: "600 17px/1.2 var(--font-spectral, serif)", color: 'var(--al-ink2)', flex: 1, minWidth: 0 }}>
            Evidence Synthesis
          </h2>

          {/* Status + conflict badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {data.from_cache ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 8,
                font: "500 11.5px/1 var(--font-instrument, sans-serif)",
                background: 'rgba(var(--al-acct), 0.10)',
                color: 'var(--al-accent)',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Cached
              </span>
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 8,
                font: "500 11.5px/1 var(--font-instrument, sans-serif)",
                background: 'rgba(var(--al-line), 0.07)',
                color: 'var(--al-mut4)',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Live
              </span>
            )}
            {hasConflictingEvidence && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 8,
                font: "600 11.5px/1 var(--font-instrument, sans-serif)",
                background: 'rgba(var(--al-warnc), 0.10)',
                color: 'var(--al-warntext)',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Conflicting evidence
              </span>
            )}
          </div>

          {/* Collapse / Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Collapse' : 'Expand'}
              style={{
                background: 'transparent', border: 'none', borderRadius: 8,
                padding: 6, cursor: 'pointer',
                color: 'var(--al-mut4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--al-line), 0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'transparent', border: 'none', borderRadius: 8,
                  padding: 6, cursor: 'pointer',
                  color: 'var(--al-mut4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--al-line), 0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Limited evidence warning */}
        {breakdown.total < 5 && (
          <div style={{
            background: 'rgba(var(--al-warnc), 0.07)',
            border: '1px solid rgba(var(--al-warnc), 0.12)',
            borderRadius: 10,
            padding: '10px 14px',
            font: "400 12.5px/1.5 var(--font-instrument, sans-serif)",
            color: 'var(--al-warntext)',
          }}>
            Found {breakdown.total} {breakdown.total === 1 ? 'study' : 'studies'} on this topic — synthesis may be limited.
          </div>
        )}

        {/* Study breakdown badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '4px 10px', borderRadius: 8,
            font: "600 12px/1 var(--font-instrument, sans-serif)",
            background: 'rgba(var(--al-acct), 0.08)',
            color: 'var(--al-accent)',
            border: '1px solid rgba(var(--al-acct), 0.18)',
          }}>
            Based on {breakdown.total} {breakdown.total === 1 ? 'study' : 'studies'}
          </span>
          {breakdown.systematic_reviews > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 10px', borderRadius: 8,
              font: "500 12px/1 var(--font-instrument, sans-serif)",
              background: 'var(--al-card2)', color: 'var(--al-ink5)',
              border: '1px solid rgba(var(--al-line), 0.10)',
            }}>
              {breakdown.systematic_reviews} Systematic Review{breakdown.systematic_reviews > 1 ? 's' : ''}
            </span>
          )}
          {breakdown.rct > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 10px', borderRadius: 8,
              font: "500 12px/1 var(--font-instrument, sans-serif)",
              background: 'var(--al-card2)', color: 'var(--al-ink5)',
              border: '1px solid rgba(var(--al-line), 0.10)',
            }}>
              {breakdown.rct} RCT{breakdown.rct > 1 ? 's' : ''}
            </span>
          )}
          {breakdown.retrospective > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 10px', borderRadius: 8,
              font: "500 12px/1 var(--font-instrument, sans-serif)",
              background: 'var(--al-card2)', color: 'var(--al-ink5)',
              border: '1px solid rgba(var(--al-line), 0.10)',
            }}>
              {breakdown.retrospective} Retrospective
            </span>
          )}
          {breakdown.case_reports > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 10px', borderRadius: 8,
              font: "500 12px/1 var(--font-instrument, sans-serif)",
              background: 'var(--al-card2)', color: 'var(--al-ink5)',
              border: '1px solid rgba(var(--al-line), 0.10)',
            }}>
              {breakdown.case_reports} Case Report{breakdown.case_reports > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {expanded && (
        <div style={{ padding: '0 22px 22px' }}>

          {/* Synthesis prose */}
          <div style={{
            paddingTop: 22, paddingBottom: 16,
            fontFamily: 'var(--font-instrument, sans-serif)',
            fontSize: 14.5,
            lineHeight: 1.72,
            color: 'var(--al-ink3)',
          }}>
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h2 style={{ margin: '22px 0 10px', fontFamily: 'var(--font-spectral, serif)', fontSize: 17, fontWeight: 700, color: 'var(--al-ink2)', lineHeight: 1.3, borderBottom: '1px solid rgba(var(--al-line), 0.10)', paddingBottom: 8 }}>
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 style={{ margin: '18px 0 8px', fontFamily: 'var(--font-spectral, serif)', fontSize: 15, fontWeight: 700, color: 'var(--al-ink2)', lineHeight: 1.3 }}>
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p style={{ margin: '0 0 14px', color: 'var(--al-ink3)', lineHeight: 1.72 }}>
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul style={{ paddingLeft: 20, marginBottom: 14, color: 'var(--al-ink3)' }}>
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ paddingLeft: 20, marginBottom: 14, color: 'var(--al-ink3)' }}>
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li style={{ marginBottom: 6, lineHeight: 1.6 }}>{children}</li>
                ),
                strong: ({ children }) => (
                  <strong style={{ fontWeight: 600, color: 'var(--al-ink2)' }}>{children}</strong>
                ),
                blockquote: ({ children }) => (
                  <blockquote style={{ borderLeft: '3px solid rgba(var(--al-acct), 0.25)', paddingLeft: 16, margin: '16px 0', color: 'var(--al-sub)', fontStyle: 'italic' }}>
                    {children}
                  </blockquote>
                ),
                code: ({ children }) => (
                  <code style={{
                    fontFamily: 'var(--font-spectral, serif)',
                    fontSize: '0.875em',
                    background: 'var(--al-card2)',
                    border: '1px solid rgba(var(--al-line), 0.15)',
                    borderRadius: 3,
                    padding: '1px 5px',
                    color: 'var(--al-ink2)',
                  }}>
                    {children}
                  </code>
                ),
                a: CitationLink,
              }}
            >
              {synthesisText}
            </ReactMarkdown>
          </div>

          {/* AI disclaimer */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'rgba(var(--al-acct), 0.07)',
            border: '1px solid rgba(var(--al-acct), 0.22)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 18,
          }}>
            <span style={{
              font: "600 10px/1 var(--font-instrument, sans-serif)",
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'var(--al-accent)', flexShrink: 0, marginTop: 2,
            }}>
              Note
            </span>
            <span style={{ font: "400 13px/1.5 var(--font-spectral, serif)", color: 'var(--al-ink3)' }}>
              AI-generated synthesis. Always verify with original sources. Click citation numbers to read full articles.
            </span>
          </div>

          {/* Source articles */}
          {synthesisArticles.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <button
                onClick={() => setShowSources(!showSources)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  font: "600 13px/1 var(--font-instrument, sans-serif)",
                  color: 'var(--al-accent)',
                  padding: '6px 0',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showSources ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
                {showSources ? 'Hide' : 'View'} source articles ({synthesisArticles.length})
              </button>

              {showSources && (
                <div style={{ marginTop: 8, borderTop: '1px solid rgba(var(--al-line), 0.10)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {synthesisArticles.map((article) => (
                    <a
                      key={article.id}
                      href={`/article/${article.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '9px 12px',
                        background: 'var(--al-card2)',
                        border: '1px solid rgba(var(--al-line), 0.10)',
                        borderRadius: 8,
                        textDecoration: 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--al-line), 0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--al-card2)')}
                    >
                      <span style={{
                        font: "700 11px/1.5 var(--font-instrument, sans-serif)",
                        color: 'var(--al-accent)',
                        background: 'rgba(var(--al-acct), 0.10)',
                        borderRadius: 3, padding: '1px 6px',
                        flexShrink: 0, minWidth: 22, textAlign: 'center' as const,
                      }}>
                        {article.citation_id}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ font: "400 13px/1.4 var(--font-spectral, serif)", color: 'var(--al-ink2)', display: 'block' }}>
                          {article.title}
                        </span>
                        <span style={{ font: "400 12px/1 var(--font-instrument, sans-serif)", color: 'var(--al-ink5)', marginTop: 4, display: 'block' }}>
                          {article.journal}{article.year ? ` · ${article.year}` : ''}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feedback row */}
          {!feedbackSubmitted && !showFeedbackNote && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ font: "400 13px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)' }}>
                Was this synthesis helpful?
              </span>
              <button
                onClick={() => submitFeedback('helpful')}
                style={{
                  height: 32, padding: '0 14px', borderRadius: 8, cursor: 'pointer',
                  font: "500 12.5px/1 var(--font-instrument, sans-serif)",
                  background: 'transparent',
                  border: '1px solid rgba(var(--al-acct), 0.3)',
                  color: 'var(--al-accent)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--al-acct), 0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Helpful
              </button>
              <button
                onClick={handleNotRelevant}
                style={{
                  height: 32, padding: '0 14px', borderRadius: 8, cursor: 'pointer',
                  font: "500 12.5px/1 var(--font-instrument, sans-serif)",
                  background: 'transparent',
                  border: '1px solid rgba(var(--al-line), 0.18)',
                  color: 'var(--al-mut4)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--al-line), 0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Not relevant
              </button>
            </div>
          )}

          {/* Feedback note */}
          {showFeedbackNote && (
            <div style={{
              background: 'var(--al-card)',
              border: '1px solid rgba(var(--al-line), 0.12)',
              borderRadius: 10,
              padding: '16px 18px',
              marginBottom: 14,
            }}>
              <label style={{
                display: 'block',
                font: "600 13px/1 var(--font-instrument, sans-serif)",
                color: 'var(--al-ink3)',
                marginBottom: 10,
              }}>
                What was wrong with this synthesis?
              </label>
              <textarea
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={3}
                placeholder="Optional: Help us improve…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px',
                  border: '1px solid rgba(var(--al-line), 0.18)',
                  borderRadius: 8, resize: 'none',
                  font: "400 13.5px/1.55 var(--font-instrument, sans-serif)",
                  color: 'var(--al-ink3)',
                  background: 'var(--al-card)',
                  outline: 'none',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--al-accent)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(var(--al-line), 0.18)')}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={handleSubmitNote}
                  style={{
                    height: 34, padding: '0 18px', borderRadius: 8, cursor: 'pointer',
                    font: "600 13px/1 var(--font-instrument, sans-serif)",
                    background: 'var(--al-accent)', color: 'white',
                    border: 'none',
                  }}
                >
                  Submit feedback
                </button>
                <button
                  onClick={() => setShowFeedbackNote(false)}
                  style={{
                    height: 34, padding: '0 16px', borderRadius: 8, cursor: 'pointer',
                    font: "500 13px/1 var(--font-instrument, sans-serif)",
                    background: 'var(--al-card2)', color: 'var(--al-mut3)',
                    border: '1px solid rgba(var(--al-line), 0.12)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Feedback confirmation */}
          {feedbackSubmitted && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 8, marginBottom: 14,
              background: 'rgba(var(--al-acct), 0.08)',
              border: '1px solid rgba(var(--al-acct), 0.20)',
              font: "500 13px/1 var(--font-instrument, sans-serif)",
              color: 'var(--al-accent)',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Thank you for your feedback.
            </div>
          )}

          {/* Sign-up nudge */}
          {!isLoggedIn && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
              background: 'rgba(var(--al-acct), 0.06)',
              border: '1px solid rgba(var(--al-acct), 0.18)',
              borderRadius: 10,
              padding: '12px 16px',
              flexWrap: 'wrap',
            }}>
              <p style={{ margin: 0, font: "400 13px/1 var(--font-instrument, sans-serif)", color: 'var(--al-sub)' }}>
                Save this synthesis to your profile
              </p>
              <a
                href="/signup"
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  height: 32, padding: '0 16px', borderRadius: 8,
                  font: "600 13px/1 var(--font-instrument, sans-serif)",
                  background: 'var(--al-accent)', color: 'white',
                  textDecoration: 'none', flexShrink: 0,
                }}
              >
                Sign up free
              </a>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
