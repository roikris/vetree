'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSavedArticles } from '@/lib/hooks/useSavedArticles'
import { Article } from '@/lib/supabase'
import { getEvidenceLevel, getEvidenceBadgeProps } from '@/lib/utils/evidenceBadge'
import { getLabelHue } from '@/lib/constants/labelColors'

type SavedEntry = {
  article: Article
  savedAt: string
}

type Tab = 'saved' | 'collections' | 'reading'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

type Props = {
  entries: SavedEntry[]
  userEmail: string | null
}

export function LibraryClient({ entries, userEmail }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const { isSaved, toggleSave } = useSavedArticles()
  const [tab, setTab] = useState<Tab>('saved')
  const [activeSpec, setActiveSpec] = useState('All')
  const [query, setQuery] = useState('')

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : null

  // Collect unique specialty labels from saved articles
  const specs = useMemo(() => {
    const seen = new Set<string>()
    entries.forEach(e => e.article.labels?.forEach(l => seen.add(l)))
    return ['All', ...Array.from(seen).slice(0, 5)]
  }, [entries])

  // Filter saved articles
  const filtered = useMemo(() => {
    let items = entries
    if (activeSpec !== 'All') {
      items = items.filter(e => e.article.labels?.includes(activeSpec))
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      items = items.filter(e =>
        e.article.title.toLowerCase().includes(q) ||
        e.article.clinical_bottom_line?.toLowerCase().includes(q) ||
        e.article.authors?.toLowerCase().includes(q) ||
        e.article.source_journal?.toLowerCase().includes(q)
      )
    }
    return items
  }, [entries, activeSpec, query])

  const tabDefs = [
    { key: 'saved' as Tab, label: 'Saved', count: entries.length },
    { key: 'collections' as Tab, label: 'Collections', count: 0 },
    { key: 'reading' as Tab, label: 'Reading list', count: 0 },
  ]

  return (
    <>
      {/* ===== APP BAR ===== */}
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
            <button
              onClick={() => router.back()}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--al-mut3)', font: "500 13.5px/1 var(--font-instrument, sans-serif)", padding: 0,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6"/>
              </svg>
              Stream
            </button>
            <span style={{ width: 1, height: 20, background: 'rgba(var(--al-line),0.15)' }} />
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--al-accent)">
                <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
              </svg>
              <span style={{ font: "600 18px/1 var(--font-spectral, serif)", color: 'var(--al-ink2)' }}>Vetree</span>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Library search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9,
              background: 'var(--al-card)', border: '1px solid rgba(var(--al-line),0.12)',
              borderRadius: 10, padding: '0 12px', width: 250,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--al-mut4)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="7"/><path strokeLinecap="round" d="M21 21l-4.3-4.3"/>
              </svg>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search your library…"
                style={{
                  flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
                  color: 'var(--al-ink3)', font: "400 13px/1 var(--font-instrument, sans-serif)",
                  padding: '10px 0',
                }}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--al-mut4)', display: 'flex' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Avatar */}
            {initials ? (
              <Link href="/profile" style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'var(--al-accent)', color: 'var(--al-onaccent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                font: "600 12.5px/1 var(--font-instrument, sans-serif)", textDecoration: 'none',
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

      {/* ===== BODY ===== */}
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '44px 32px 90px' }}>

        {/* HEADER */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 24, marginBottom: 30, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{
              font: "600 12px/1 var(--font-instrument, sans-serif)",
              letterSpacing: '.15em', textTransform: 'uppercase',
              color: 'var(--al-accent)', marginBottom: 14,
            }}>
              {userEmail ? `${userEmail.split('@')[0].toUpperCase()} · Personal shelf` : 'Personal shelf'}
            </div>
            <h1 style={{
              margin: '0 0 8px',
              font: "500 40px/1.05 var(--font-spectral, serif)",
              color: 'var(--al-ink2)', letterSpacing: '-.015em',
            }}>
              My Library
            </h1>
            <p style={{
              margin: 0,
              font: "italic 400 15px/1.4 var(--font-spectral, serif)",
              color: 'var(--al-mut3)',
            }}>
              Everything you saved, collected and set aside to read — kept close.
            </p>
          </div>

          {/* Stat block */}
          <div style={{ display: 'flex', gap: 26 }}>
            <div>
              <div style={{ font: "600 26px/1 var(--font-spectral, serif)", color: 'var(--al-ink2)' }}>{entries.length}</div>
              <div style={{ font: "400 12px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)', marginTop: 5 }}>Saved</div>
            </div>
            <div style={{ width: 1, background: 'rgba(var(--al-line),0.1)' }} />
            <div>
              <div style={{ font: "600 26px/1 var(--font-spectral, serif)", color: 'var(--al-ink2)' }}>0</div>
              <div style={{ font: "400 12px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)', marginTop: 5 }}>Collections</div>
            </div>
            <div style={{ width: 1, background: 'rgba(var(--al-line),0.1)' }} />
            <div>
              <div style={{ font: "600 26px/1 var(--font-spectral, serif)", color: 'var(--al-ink2)' }}>0</div>
              <div style={{ font: "400 12px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)', marginTop: 5 }}>To read</div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          borderBottom: '1px solid rgba(var(--al-line),0.1)', marginBottom: 30,
        }}>
          {tabDefs.map(t => {
            const active = t.key === tab
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none', border: 'none',
                  borderBottom: active ? '2px solid var(--al-accent)' : '2px solid transparent',
                  cursor: 'pointer', padding: '12px 16px 13px',
                  font: active
                    ? "600 14px/1 var(--font-instrument, sans-serif)"
                    : "500 14px/1 var(--font-instrument, sans-serif)",
                  color: active ? 'var(--al-ink2)' : 'var(--al-mut3)',
                  transition: 'color .15s',
                }}
              >
                {t.label}
                <span style={{
                  font: "600 11px/1 var(--font-instrument, sans-serif)",
                  padding: '3px 7px', borderRadius: 999,
                  background: active ? 'var(--al-accent)' : 'rgba(var(--al-line),0.08)',
                  color: active ? 'var(--al-onaccent)' : 'var(--al-mut4)',
                }}>
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* ===== SAVED TAB ===== */}
        {tab === 'saved' && (
          <>
            {/* Specialty filter pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
              {specs.map(spec => {
                const active = spec === activeSpec
                const hue = spec === 'All' ? 'var(--al-accent)' : getLabelHue(spec)
                return (
                  <button
                    key={spec}
                    onClick={() => setActiveSpec(spec)}
                    style={{
                      padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                      font: `${active ? '600' : '500'} 12.5px/1 var(--font-instrument, sans-serif)`,
                      border: active ? `1px solid ${hue}` : '1px solid rgba(var(--al-line),0.16)',
                      background: active ? `color-mix(in srgb, ${hue} 15%, transparent)` : 'transparent',
                      color: active ? hue : 'var(--al-sub)',
                      transition: 'all .15s',
                    }}
                  >
                    {spec}
                  </button>
                )
              })}
              <span style={{
                marginLeft: 'auto',
                font: "400 12.5px/1 var(--font-instrument, sans-serif)",
                color: 'var(--al-mut6)',
              }}>
                {filtered.length} shown · Recently saved
              </span>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '70px 20px',
                border: '1px dashed rgba(var(--al-line),0.14)', borderRadius: 18,
              }}>
                <p style={{
                  margin: 0,
                  font: "italic 400 16px/1.5 var(--font-spectral, serif)",
                  color: 'var(--al-mut3)',
                }}>
                  {entries.length === 0
                    ? 'Nothing saved yet — bookmark articles to build your shelf.'
                    : 'Nothing saved under this filter yet.'}
                </p>
                {entries.length === 0 && (
                  <Link href="/" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 20,
                    background: 'var(--al-accent)', color: 'var(--al-onaccent)',
                    borderRadius: 10, padding: '11px 20px',
                    font: "600 13.5px/1 var(--font-instrument, sans-serif)",
                    textDecoration: 'none',
                  }}>
                    Explore articles
                  </Link>
                )}
              </div>
            )}

            {/* 2-col card grid */}
            {filtered.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {filtered.map(({ article, savedAt }) => {
                  const evLevel = getEvidenceLevel(article.strength_of_evidence, article.labels)
                  const ev = getEvidenceBadgeProps(evLevel)
                  const primaryLabel = article.labels?.[0]
                  const labelHue = primaryLabel ? getLabelHue(primaryLabel) : '#B4AD9A'
                  const saved = isSaved(article.id)

                  return (
                    <article
                      key={article.id}
                      style={{
                        background: 'var(--al-card)',
                        border: '1px solid rgba(var(--al-line),0.09)',
                        borderRadius: 16, padding: '22px 24px',
                        display: 'flex', flexDirection: 'column',
                        transition: 'border-color .15s',
                      }}
                    >
                      {/* Top row: chips + bookmark */}
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', gap: 12, marginBottom: 15,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, font: "500 11.5px/1 var(--font-instrument, sans-serif)", flexWrap: 'wrap' }}>
                          {primaryLabel && (
                            <span className="al-spec-text" style={{ '--chip-h': labelHue } as React.CSSProperties}>
                              {primaryLabel}
                            </span>
                          )}
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--al-mut7)', flexShrink: 0 }} />
                          <span className="al-ev-chip" style={{ '--ev-h': ev.hue, '--ev-dot': ev.dot } as React.CSSProperties}>
                            <span className="al-ev-dot" />
                            {evLevel === 'gold' ? 'RCT' : evLevel === 'silver' ? 'Cohort' : evLevel === 'bronze' ? 'Retrospective' : 'Study'}
                          </span>
                        </div>
                        <button
                          onClick={() => user && toggleSave(article.id)}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24"
                            fill={saved ? 'var(--al-accent)' : 'none'}
                            stroke={saved ? 'var(--al-accent)' : 'var(--al-mut4)'}
                            strokeWidth="1.8"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14v18l-7-5-7 5V3z"/>
                          </svg>
                        </button>
                      </div>

                      {/* Bottom line */}
                      <Link href={`/article/${article.id}`} style={{ textDecoration: 'none', flex: 1 }}>
                        <p style={{
                          margin: '0 0 16px',
                          font: "500 18px/1.42 var(--font-spectral, serif)",
                          color: 'var(--al-ink2)', letterSpacing: '-.006em',
                        }}>
                          {article.clinical_bottom_line}
                        </p>
                      </Link>

                      {/* Footer: byline + saved ago */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 12, paddingTop: 14, borderTop: '1px solid rgba(var(--al-line),0.08)',
                      }}>
                        <span style={{
                          font: "italic 400 12.5px/1.35 var(--font-spectral, serif)",
                          color: 'var(--al-mut3)',
                        }}>
                          {article.authors ? `${article.authors.split(',')[0]}, et al. · ` : ''}{article.source_journal}
                        </span>
                        <span style={{
                          font: "400 11.5px/1 var(--font-instrument, sans-serif)",
                          color: 'var(--al-mut6)', flexShrink: 0,
                        }}>
                          {timeAgo(savedAt)}
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ===== COLLECTIONS TAB ===== */}
        {tab === 'collections' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {/* Dashed "New collection" placeholder */}
            <button style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, minHeight: 200, background: 'transparent',
              border: '1px dashed rgba(var(--al-line),0.18)', borderRadius: 18,
              cursor: 'pointer', color: 'var(--al-mut3)',
              font: "500 13.5px/1 var(--font-instrument, sans-serif)",
            }}>
              <span style={{
                width: 44, height: 44, borderRadius: '50%',
                border: '1px solid rgba(var(--al-line),0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                font: "300 26px/1 var(--font-instrument, sans-serif)",
              }}>＋</span>
              New collection
            </button>
          </div>
        )}

        {/* ===== READING LIST TAB ===== */}
        {tab === 'reading' && (
          <div style={{
            textAlign: 'center', padding: '70px 20px',
            border: '1px dashed rgba(var(--al-line),0.14)', borderRadius: 18,
          }}>
            <p style={{
              margin: 0,
              font: "italic 400 16px/1.5 var(--font-spectral, serif)",
              color: 'var(--al-mut3)',
            }}>
              Reading list coming soon.
            </p>
          </div>
        )}

      </div>
    </>
  )
}
