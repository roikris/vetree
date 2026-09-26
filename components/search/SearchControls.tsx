'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useRef, useEffect, useState, ReactNode } from 'react'
import Link from 'next/link'
import { ParsedFilters, FeedView, QuickFilter } from '@/types/search'
import { buildSearchParams } from '@/lib/utils/searchParams'
import { defaultQuickFilterFor } from '@/lib/utils/species'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { VETERINARY_LABELS } from '@/lib/constants/labels'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { Footer } from '@/components/ui/Footer'
import { BottomNav } from '@/components/ui/BottomNav'
import { DarkModeToggle } from '@/components/ui/DarkModeToggle'

// ─── Quick filter pills ───────────────────────────────────────────────────────
const QUICK_PILLS = [
  { label: 'Latest',       labels: [] as string[] },
  { label: 'Cardiology',   labels: ['Cardiology'] },
  { label: 'Emergency',    labels: ['Emergency'] },
]

// ─── Species scope ────────────────────────────────────────────────────────────
// Replaces the old 'Small Animal' quick pill, which filtered on the strict label and
// would have hidden the ~2,800 enriched articles with no species label at all. Scope
// semantics live in lib/utils/species.ts; 'small-animal' is the default.
const SPECIES_OPTIONS: { value: QuickFilter; label: string }[] = [
  { value: 'small-animal', label: 'Small animal' },
  { value: 'all',          label: 'All species' },
  { value: 'large-animal', label: 'Large animal' },
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
  /** True when the search errored or timed out — its 0 count must not be logged */
  searchFailed?: boolean
  children?: ReactNode
}

// ─── Shared inline style helpers ─────────────────────────────────────────────
const barBg: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
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
  padding: '0 18px 13px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'nowrap',
  overflowX: 'auto',
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SearchControls({
  initialFilters,
  availableJournals,
  availableEvidenceLevels,
  resultsCount,
  searchFailed = false,
  children,
}: SearchControlsProps) {
  const router = useRouter()
  const filtersRef = useRef(initialFilters)

  const [searchOpen, setSearchOpen] = useState(!!initialFilters.search)
  const [searchQuery, setSearchQuery] = useState(initialFilters.search)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [journalOpen, setJournalOpen] = useState(false)
  const [specialtyOpen, setSpecialtyOpen] = useState(false)

  const specialtyRef = useRef<HTMLDivElement>(null)
  const evidenceRef = useRef<HTMLDivElement>(null)
  const journalRef = useRef<HTMLDivElement>(null)

  const { user } = useAuth()
  const { isAdmin } = useAdmin()

  // ─── Search logging ───────────────────────────────────────────────────────
  // Fire after navigation completes so resultsCount reflects actual results.
  // Dedup ref prevents double-logging the same query on unrelated re-renders, and on the
  // reader narrowing the results afterwards. Only the UNFILTERED search is logged (a new
  // search always starts unfiltered; a shared link that arrives pre-filtered is skipped),
  // so results_count = 0 means Vetree has nothing on the topic, not "nothing in this scope".
  const lastLoggedQuery = useRef('')
  useEffect(() => {
    const query = initialFilters.search?.trim() ?? ''
    const unfiltered =
      initialFilters.quickFilter === defaultQuickFilterFor(query) &&
      initialFilters.labels.length === 0 &&
      initialFilters.evidence.length === 0 &&
      initialFilters.journals.length === 0
    // A failed search is not logged (its 0 isn't a result) and not marked as logged, so a
    // successful retry of the same query still is
    if (query.length >= 2 && unfiltered && !searchFailed && query !== lastLoggedQuery.current) {
      lastLoggedQuery.current = query
      fetch('/api/analytics/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, results_count: resultsCount ?? 0 }),
      }).catch(() => { /* best-effort */ })
    }
    if (!query) lastLoggedQuery.current = ''
  }, [initialFilters.search, initialFilters.quickFilter, initialFilters.labels.length, initialFilters.evidence.length, initialFilters.journals.length, resultsCount, searchFailed])

  useEffect(() => { filtersRef.current = initialFilters }, [initialFilters])

  // Sync search input when URL-driven navigation changes search
  useEffect(() => {
    setSearchQuery(initialFilters.search)
    if (initialFilters.search) setSearchOpen(true)
  }, [initialFilters.search])

  // Close dropdowns on outside click — use contains() so click inside still registers
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (specialtyRef.current && !specialtyRef.current.contains(e.target as Node)) setSpecialtyOpen(false)
      if (evidenceRef.current && !evidenceRef.current.contains(e.target as Node)) setEvidenceOpen(false)
      if (journalRef.current && !journalRef.current.contains(e.target as Node)) setJournalOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const updateFilters = useCallback((patch: Partial<ParsedFilters>) => {
    const updated = { ...filtersRef.current, ...patch, page: 1 }
    filtersRef.current = updated
    router.push(`/?${buildSearchParams(updated)}`)
  }, [router])

  const setView = (view: FeedView) => updateFilters({ view })

  // A new search starts unfiltered (all species, no specialty/evidence/journal filters);
  // the reader narrows the results with the filter bar. Clearing it returns to the feed's
  // defaults. See defaultQuickFilterFor in lib/utils/species.ts.
  const cleared = (search: string): Partial<ParsedFilters> => ({
    search,
    quickFilter: defaultQuickFilterFor(search),
    labels: [],
    labelOperator: 'OR',
    evidence: [],
    journals: [],
  })

  const handleSearchSubmit = () => {
    updateFilters(cleared(searchQuery))
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearchSubmit()
    if (e.key === 'Escape') {
      setSearchOpen(false)
      setSearchQuery('')
      updateFilters(cleared(''))
    }
  }

  const clearSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
    updateFilters(cleared(''))
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
  const sActive = initialFilters.labels.length > 0

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
            {/* aria-label: the visible wordmark is hidden on phones while search is open */}
            <Link href="/" aria-label="Vetree home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--al-accent)" aria-hidden="true">
                <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z" />
              </svg>
              {/* Wordmark and account link step aside on phones while search is open, so the
                  input gets usable width; the bottom nav's Profile tab still reaches sign-in */}
              <span className={searchOpen ? 'hidden md:inline' : undefined} style={{
                fontFamily: 'var(--font-spectral, serif)',
                fontSize: 21, fontWeight: 600, lineHeight: 1,
                color: 'var(--al-ink2)', letterSpacing: '.01em',
              }}>
                Vetree
              </span>
            </Link>

            {/* View switcher — hidden on mobile */}
            <div className="hidden md:flex" style={{
              gap: 4,
              background: 'rgba(var(--al-line, 232,224,204), .05)',
              border: '1px solid rgba(var(--al-line, 232,224,204), .1)',
              borderRadius: 11, padding: 4,
            }}>
              {(['stream', 'grove', 'list'] as FeedView[]).map(v => (
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

            {/* Right side — may shrink (minWidth 0) so the open search box fits phone widths */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, flex: '1 1 auto', minWidth: 0 }}>

              {/* Search */}
              {searchOpen ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  background: 'var(--al-card)',
                  border: '1px solid var(--al-accent)',
                  borderRadius: 10, padding: '0 6px 0 12px',
                  // 306px on desktop; shrinks on phones instead of pushing the page wider
                  flex: '0 1 306px', minWidth: 0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--al-mut4)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.3-4.3" />
                  </svg>
                  <input
                    autoFocus
                    data-testid="search-input"
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
                  data-testid="search-toggle"
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

              {isAdmin && (
                <Link href="/admin" className="hidden md:block" style={{
                  fontFamily: 'var(--font-instrument, sans-serif)',
                  fontSize: 13.5, fontWeight: 500, lineHeight: 1,
                  color: 'var(--al-accent)', textDecoration: 'none',
                }}>
                  Admin
                </Link>
              )}

              <Link href="/library" className="hidden md:block" style={{
                fontFamily: 'var(--font-instrument, sans-serif)',
                fontSize: 13.5, fontWeight: 500, lineHeight: 1,
                color: 'var(--al-sub)', textDecoration: 'none',
              }}>
                Library
              </Link>

              <span className="hidden md:block"><DarkModeToggle /></span>

              <span className={searchOpen ? 'hidden md:contents' : 'contents'}>
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
              </span>
            </div>
          </div>

          {/* ─── Filter pill bar — hidden in grove view ──────────────────── */}
          {view !== 'grove' && (
            <div style={{ maxWidth: 1020, margin: '0 auto', padding: '0 18px 13px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Quick-filter pills — scrollable */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', flex: 1 }} className="scrollbar-hide">
                {/* Species scope — inside the scrollable row so it never overflows on mobile */}
                <div role="group" aria-label="Species" style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {SPECIES_OPTIONS.map(opt => {
                    const active = initialFilters.quickFilter === opt.value
                    return (
                      <button
                        key={opt.value}
                        data-testid={`species-${opt.value}`}
                        aria-pressed={active}
                        onClick={() => updateFilters({ quickFilter: opt.value })}
                        style={{ ...pillStyle(active), flexShrink: 0 }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
                <span aria-hidden style={{ width: 1, height: 18, flexShrink: 0, background: 'rgba(var(--al-line, 232,224,204), .18)' }} />
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
              </div>

              {/* Dropdown triggers — outside scrollable container so they don't get clipped */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {/* Specialty dropdown */}
                <div ref={specialtyRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setSpecialtyOpen(o => !o); setEvidenceOpen(false); setJournalOpen(false) }}
                    style={dropdownPillStyle(sActive)}
                  >
                    Specialty{sActive ? ` (${initialFilters.labels.length})` : ''} <span style={{ fontSize: 10 }}>▾</span>
                  </button>
                  {specialtyOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
                      background: 'var(--al-card)',
                      border: '1px solid rgba(var(--al-line, 232,224,204), .12)',
                      borderRadius: 12, padding: '8px 0',
                      maxHeight: 300, overflowY: 'auto', minWidth: 220,
                      boxShadow: '0 8px 24px rgba(0,0,0,.25)',
                    }}>
                      {VETERINARY_LABELS.map(label => {
                        const on = initialFilters.labels.includes(label)
                        const nextLabels = on
                          ? initialFilters.labels.filter(l => l !== label)
                          : [...initialFilters.labels, label]
                        const href = `/?${buildSearchParams({ ...initialFilters, labels: nextLabels, page: 1 })}`
                        return (
                          <Link
                            key={label}
                            href={href}
                            onClick={() => setSpecialtyOpen(false)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 9,
                              width: '100%', padding: '9px 16px',
                              background: on ? 'rgba(var(--al-line, 232,224,204), .06)' : 'none',
                              color: on ? 'var(--al-accent)' : 'var(--al-ink3)',
                              fontFamily: 'var(--font-instrument, sans-serif)',
                              fontSize: 13, fontWeight: on ? 600 : 400, lineHeight: 1.2,
                              cursor: 'pointer', textDecoration: 'none',
                            }}
                          >
                            {on && <span style={{ color: 'var(--al-accent)', flexShrink: 0 }}>✓</span>}
                            {label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Evidence dropdown */}
                <div ref={evidenceRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setEvidenceOpen(o => !o); setJournalOpen(false) }}
                    style={dropdownPillStyle(evActive)}
                  >
                    Evidence{evActive ? ` (${initialFilters.evidence.length})` : ''} <span style={{ fontSize: 10 }}>▾</span>
                  </button>
                  {evidenceOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
                      background: 'var(--al-card)',
                      border: '1px solid rgba(var(--al-line, 232,224,204), .12)',
                      borderRadius: 12, padding: '8px 0', minWidth: 220,
                      boxShadow: '0 8px 24px rgba(0,0,0,.25)',
                    }}>
                      {availableEvidenceLevels.map(level => {
                        const on = initialFilters.evidence.includes(level)
                        const nextEvidence = on
                          ? initialFilters.evidence.filter(e => e !== level)
                          : [...initialFilters.evidence, level]
                        const href = `/?${buildSearchParams({ ...initialFilters, evidence: nextEvidence, page: 1 })}`
                        return (
                          <Link
                            key={level}
                            href={href}
                            onClick={() => setEvidenceOpen(false)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 9,
                              width: '100%', padding: '9px 16px',
                              background: on ? 'rgba(var(--al-line, 232,224,204), .06)' : 'none',
                              color: on ? 'var(--al-accent)' : 'var(--al-ink3)',
                              fontFamily: 'var(--font-instrument, sans-serif)',
                              fontSize: 13, fontWeight: on ? 600 : 400, lineHeight: 1.2,
                              cursor: 'pointer', textDecoration: 'none',
                            }}
                          >
                            {on && <span style={{ color: 'var(--al-accent)', flexShrink: 0 }}>✓</span>}
                            {level}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Journal dropdown */}
                <div ref={journalRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setJournalOpen(o => !o); setEvidenceOpen(false) }}
                    style={dropdownPillStyle(jActive)}
                  >
                    Journal{jActive ? ` (${initialFilters.journals.length})` : ''} <span style={{ fontSize: 10 }}>▾</span>
                  </button>
                  {journalOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
                      background: 'var(--al-card)',
                      border: '1px solid rgba(var(--al-line, 232,224,204), .12)',
                      borderRadius: 12, padding: '8px 0',
                      maxHeight: 280, overflowY: 'auto', minWidth: 260,
                      boxShadow: '0 8px 24px rgba(0,0,0,.25)',
                    }}>
                      {availableJournals.map(journal => {
                        const on = initialFilters.journals.includes(journal)
                        const nextJournals = on
                          ? initialFilters.journals.filter(j => j !== journal)
                          : [...initialFilters.journals, journal]
                        const href = `/?${buildSearchParams({ ...initialFilters, journals: nextJournals, page: 1 })}`
                        return (
                          <Link
                            key={journal}
                            href={href}
                            onClick={() => setJournalOpen(false)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 9,
                              width: '100%', padding: '9px 16px',
                              background: on ? 'rgba(var(--al-line, 232,224,204), .06)' : 'none',
                              color: on ? 'var(--al-accent)' : 'var(--al-ink3)',
                              fontFamily: 'var(--font-instrument, sans-serif)',
                              fontSize: 13, fontWeight: on ? 600 : 400, lineHeight: 1.2,
                              cursor: 'pointer', textDecoration: 'none',
                            }}
                          >
                            {on && <span style={{ color: 'var(--al-accent)', flexShrink: 0 }}>✓</span>}
                            {journal}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
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
