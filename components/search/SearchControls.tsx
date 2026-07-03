'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useRef, useEffect, useState, ReactNode } from 'react'
import Link from 'next/link'
import { ParsedFilters, FeedView } from '@/types/search'
import { buildSearchParams } from '@/lib/utils/searchParams'
import { useAuth } from '@/lib/hooks/useAuth'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { Footer } from '@/components/ui/Footer'
import { BottomNav } from '@/components/ui/BottomNav'
import { DarkModeToggle } from '@/components/ui/DarkModeToggle'

// ─── Quick filter pills ───────────────────────────────────────────────────────
const QUICK_PILLS = [
  { label: 'Latest',       labels: [] as string[] },
  { label: 'Small Animal', labels: ['Small Animal'] },
  { label: 'Cardiology',   labels: ['Cardiology'] },
  { label: 'Emergency',    labels: ['Emergency'] },
]

function isPillActive(pill: (typeof QUICK_PILLS)[number], filters: ParsedFilters) {
  if (pill.labels.length === 0) {
    return filters.labels.length === 0 && filters.evidence.length === 0 && filters.journals.length === 0
  }
  return (
    pill.labels.length === filters.labels.length &&
    pill.labels.every(l => filters.labels.includes(l))
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
type SearchControlsProps = {
  initialFilters: ParsedFilters
  availableJournals: string[]
  availableEvidenceLevels: string[]
  resultsCount?: number
  children?: ReactNode
}

// ─── Shared inline style helpers ─────────────────────────────────────────────
const barBg: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 20,
  background: 'rgba(var(--al-bar, 20,18,14), .86)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  borderBottom: '1px solid rgba(var(--al-line, 232,224,204), .1)',
}
const barInner: React.CSSProperties = {
  maxWidth: 1020,
  margin: '0 auto',
  padding: '15px 32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 20,
}
const pillRow: React.CSSProperties = {
  maxWidth: 1020,
  margin: '0 auto',
  padding: '0 32px 15px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap' as const,
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SearchControls({
  initialFilters,
  availableJournals,
  availableEvidenceLevels,
  children,
}: SearchControlsProps) {
  const router = useRouter()
  const filtersRef = useRef(initialFilters)

  const [searchOpen, setSearchOpen] = useState(!!initialFilters.search)
  const [searchQuery, setSearchQuery] = useState(initialFilters.search)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [journalOpen, setJournalOpen] = useState(false)

  const { user } = useAuth()

  useEffect(() => { filtersRef.current = initialFilters }, [initialFilters])

  // Sync search input when URL-driven navigation changes search
  useEffect(() => {
    setSearchQuery(initialFilters.search)
    if (initialFilters.search) setSearchOpen(true)
  }, [initialFilters.search])

  // Close dropdowns on outside click
  useEffect(() => {
    if (!evidenceOpen && !journalOpen) return
    const handler = () => { setEvidenceOpen(false); setJournalOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [evidenceOpen, journalOpen])

  const updateFilters = useCallback((patch: Partial<ParsedFilters>) => {
    const updated = { ...filtersRef.current, ...patch, page: 1 }
    filtersRef.current = updated
    router.push(`/?${buildSearchParams(updated)}`)
  }, [router])

  const setView = (view: FeedView) => updateFilters({ view })

  const handleSearchSubmit = () => {
    updateFilters({ search: searchQuery })
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearchSubmit()
    if (e.key === 'Escape') {
      setSearchOpen(false)
      setSearchQuery('')
      updateFilters({ search: '' })
    }
  }

  const clearSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
    updateFilters({ search: '' })
  }

  // Avatar initials
  const email = user?.email || ''
  const initials = email
    .split('@')[0]
    .split(/[._-]/)
    .map((p: string) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  const view = initialFilters.view ?? 'stream'
  const evActive = initialFilters.evidence.length > 0
  const jActive = initialFilters.journals.length > 0

  // ─── Pill button style helper ───────────────────────────────────────────────
  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 15px',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'var(--font-instrument, sans-serif)',
    fontSize: 12.5,
    fontWeight: active ? 600 : 500,
    lineHeight: 1,
    border: active
      ? '1px solid var(--al-accent)'
      : '1px solid rgba(var(--al-line, 232,224,204), .18)',
    background: active ? 'var(--al-accent)' : 'transparent',
    color: active ? 'var(--al-on-accent)' : 'var(--al-sub)',
    transition: 'all .15s ease',
  })

  const dropdownPillStyle = (active: boolean): React.CSSProperties => ({
    ...pillStyle(active),
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
  })

  return (
    <>
      <Onboarding />

      <div style={{ minHeight: '100vh' }}>
        {/* ─── Sticky App Bar ─────────────────────────────────────────────── */}
        <header style={barBg}>

          {/* Main row */}
          <div style={barInner}>

            {/* Logo */}
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--al-accent)">
                <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z" />
              </svg>
              <span style={{
                fontFamily: 'var(--font-spectral, serif)',
                fontSize: 21, fontWeight: 600, lineHeight: 1,
                color: 'var(--al-ink2)', letterSpacing: '.01em',
              }}>
                Vetree
              </span>
            </Link>

            {/* View switcher */}
            <div style={{
              display: 'flex', gap: 4,
              background: 'rgba(var(--al-line, 232,224,204), .05)',
              border: '1px solid rgba(var(--al-line, 232,224,204), .1)',
              borderRadius: 11, padding: 4,
            }}>
              {(['stream', 'list'] as FeedView[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: '8px 17px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-instrument, sans-serif)',
                    fontSize: 13, fontWeight: 600, lineHeight: 1,
                    background: view === v ? 'var(--al-accent)' : 'transparent',
                    color: view === v ? 'var(--al-on-accent)' : 'var(--al-mut2)',
                    transition: 'all .15s ease',
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Right side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

              {/* Search */}
              {searchOpen ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  background: 'var(--al-card)',
                  border: '1px solid var(--al-accent)',
                  borderRadius: 10, padding: '0 6px 0 12px', width: 306,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--al-mut4)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.3-4.3" />
                  </svg>
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search titles, bottom lines, authors…"
                    style={{
                      flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
                      fontFamily: 'var(--font-instrument, sans-serif)',
                      fontSize: 13.5, fontWeight: 400, lineHeight: 1,
                      color: 'var(--al-ink3)', padding: '11px 0',
                    }}
                  />
                  <button
                    onClick={clearSearch}
                    style={{
                      width: 26, height: 26, flexShrink: 0, borderRadius: 7,
                      background: 'none', border: 'none',
                      color: 'var(--al-mut4)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'var(--al-card)',
                    border: '1px solid rgba(var(--al-line, 232,224,204), .12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--al-mut4)', cursor: 'pointer',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.3-4.3" />
                  </svg>
                </button>
              )}

              <Link href="/library" style={{
                fontFamily: 'var(--font-instrument, sans-serif)',
                fontSize: 13.5, fontWeight: 500, lineHeight: 1,
                color: 'var(--al-sub)', textDecoration: 'none',
              }}>
                Library
              </Link>

              <DarkModeToggle />

              {user ? (
                <Link href="/profile" style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'var(--al-accent)', color: 'var(--al-on-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-instrument, sans-serif)',
                  fontSize: 12.5, fontWeight: 600, lineHeight: 1,
                  textDecoration: 'none', flexShrink: 0,
                }}>
                  {initials}
                </Link>
              ) : (
                <Link href="/login" style={{
                  fontFamily: 'var(--font-instrument, sans-serif)',
                  fontSize: 13, fontWeight: 600, lineHeight: 1,
                  color: 'var(--al-accent)', textDecoration: 'none',
                }}>
                  Sign in
                </Link>
              )}
            </div>
          </div>

          {/* ─── Filter pill bar ─────────────────────────────────────────── */}
          <div style={pillRow}>
            {QUICK_PILLS.map(pill => {
              const active = isPillActive(pill, initialFilters)
              return (
                <button
                  key={pill.label}
                  onClick={() => updateFilters({ labels: pill.labels, evidence: [], journals: [] })}
                  style={pillStyle(active)}
                >
                  {pill.label}
                </button>
              )
            })}

            {/* Evidence dropdown */}
            <div style={{ position: 'relative' }} onMouseDown={e => e.stopPropagation()}>
              <button
                onClick={() => { setEvidenceOpen(o => !o); setJournalOpen(false) }}
                style={dropdownPillStyle(evActive)}
              >
                Evidence{evActive ? ` (${initialFilters.evidence.length})` : ''} <span style={{ fontSize: 10 }}>▾</span>
              </button>
              {evidenceOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40,
                  background: 'var(--al-card)',
                  border: '1px solid rgba(var(--al-line, 232,224,204), .12)',
                  borderRadius: 12, padding: '8px 0', minWidth: 220,
                  boxShadow: '0 8px 24px rgba(0,0,0,.25)',
                }}>
                  {availableEvidenceLevels.map(level => {
                    const on = initialFilters.evidence.includes(level)
                    return (
                      <button
                        key={level}
                        onClick={() => {
                          const next = on
                            ? initialFilters.evidence.filter(e => e !== level)
                            : [...initialFilters.evidence, level]
                          updateFilters({ evidence: next })
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 9,
                          width: '100%', padding: '9px 16px',
                          background: on ? 'rgba(var(--al-line, 232,224,204), .06)' : 'none',
                          border: 'none',
                          color: on ? 'var(--al-accent)' : 'var(--al-ink3)',
                          fontFamily: 'var(--font-instrument, sans-serif)',
                          fontSize: 13, fontWeight: on ? 600 : 400, lineHeight: 1.2,
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {on && <span style={{ color: 'var(--al-accent)', flexShrink: 0 }}>✓</span>}
                        {level}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Journal dropdown */}
            <div style={{ position: 'relative' }} onMouseDown={e => e.stopPropagation()}>
              <button
                onClick={() => { setJournalOpen(o => !o); setEvidenceOpen(false) }}
                style={dropdownPillStyle(jActive)}
              >
                Journal{jActive ? ` (${initialFilters.journals.length})` : ''} <span style={{ fontSize: 10 }}>▾</span>
              </button>
              {journalOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40,
                  background: 'var(--al-card)',
                  border: '1px solid rgba(var(--al-line, 232,224,204), .12)',
                  borderRadius: 12, padding: '8px 0',
                  maxHeight: 280, overflowY: 'auto', minWidth: 260,
                  boxShadow: '0 8px 24px rgba(0,0,0,.25)',
                }}>
                  {availableJournals.map(journal => {
                    const on = initialFilters.journals.includes(journal)
                    return (
                      <button
                        key={journal}
                        onClick={() => {
                          const next = on
                            ? initialFilters.journals.filter(j => j !== journal)
                            : [...initialFilters.journals, journal]
                          updateFilters({ journals: next })
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 9,
                          width: '100%', padding: '9px 16px',
                          background: on ? 'rgba(var(--al-line, 232,224,204), .06)' : 'none',
                          border: 'none',
                          color: on ? 'var(--al-accent)' : 'var(--al-ink3)',
                          fontFamily: 'var(--font-instrument, sans-serif)',
                          fontSize: 13, fontWeight: on ? 600 : 400, lineHeight: 1.2,
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {on && <span style={{ color: 'var(--al-accent)', flexShrink: 0 }}>✓</span>}
                        {journal}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ─── Main content ────────────────────────────────────────────────── */}
        <main id="main-feed">
          {children}
        </main>

        <Footer />
      </div>

      <BottomNav />
    </>
  )
}
