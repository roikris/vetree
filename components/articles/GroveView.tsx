'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getLabelHue } from '@/lib/constants/labelColors'

type GrovePanelArticle = {
  id: string
  clinical_bottom_line: string
  strength_of_evidence: string | null
  source_journal: string | null
}

type GroveBranch = {
  name: string
  count: number
  connects: string[]
  articles: GrovePanelArticle[]
}

// Fixed node positions in SVG viewport 0 0 460 540, center at (230,300)
const NODE_POSITIONS = [
  { x: 350, y: 96  },   // top-right
  { x: 414, y: 246 },   // right
  { x: 372, y: 452 },   // bottom-right
  { x: 84,  y: 456 },   // bottom-left
  { x: 60,  y: 300 },   // left
  { x: 108, y: 118 },   // top-left
]

const CX = 230, CY = 300

// Quadratic bezier from center to node with perpendicular bend
function branchPath(x: number, y: number, bend = 26): string {
  const mx = (CX + x) / 2, my = (CY + y) / 2
  const dx = x - CX, dy = y - CY
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len
  const ctrlx = mx + nx * bend, ctrly = my + ny * bend
  return `M${CX},${CY} Q${ctrlx.toFixed(0)},${ctrly.toFixed(0)} ${x},${y}`
}

// Scale node radius by article count
function nodeBase(count: number): number {
  return Math.max(20, Math.min(36, 18 + Math.sqrt(count) * 3.5))
}

// Abbreviate long specialty names for node labels
function shortName(name: string): string {
  return name
    .replace('Internal Medicine', 'Internal Med.')
    .replace('Ophthalmology', 'Ophthal.')
    .replace('Pharmacology', 'Pharma.')
    .replace('Soft Tissue Surgery', 'Soft Tissue')
    .replace('Reproduction', 'Repro.')
}

function getEvShort(ev: string | null): { c: string; label: string } {
  if (!ev) return { c: '#8A8272', label: 'Study' }
  const e = ev.toLowerCase()
  if (e.includes('rct') || e.includes('meta') || e.includes('randomis') || e.includes('randomiz')) return { c: '#A9E07C', label: 'RCT' }
  if (e.includes('cohort') || e.includes('prospective')) return { c: '#8FBEEC', label: 'Cohort' }
  return { c: '#E8B060', label: 'Retrospective' }
}

export function GroveView() {
  const [branches, setBranches] = useState<GroveBranch[]>([])
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/grove')
      .then(r => r.json())
      .then(data => { setBranches(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ maxWidth: 1020, margin: '0 auto', padding: '60px 32px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-spectral, serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--al-mut3)' }}>
          Loading your grove…
        </p>
      </div>
    )
  }

  if (!branches.length) {
    return (
      <div style={{ maxWidth: 1020, margin: '0 auto', padding: '60px 32px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-spectral, serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--al-mut3)' }}>
          No recent articles found. Check back soon.
        </p>
      </div>
    )
  }

  const sel = branches[Math.min(selected, branches.length - 1)]
  const selColor = getLabelHue(sel.name)

  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', padding: '30px 32px 70px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          margin: '0 0 5px',
          fontFamily: 'var(--font-spectral, serif)', fontSize: 30, fontWeight: 500,
          lineHeight: 1.1, color: 'var(--al-ink2)', letterSpacing: '-.01em',
        }}>
          Your grove
        </h1>
        <p style={{
          margin: 0,
          fontFamily: 'var(--font-spectral, serif)', fontStyle: 'italic',
          fontSize: 14, fontWeight: 400, lineHeight: 1.4, color: 'var(--al-mut3)',
        }}>
          Knowledge branching from what you follow. Tap a branch to explore its findings.
        </p>
      </div>

      {/* Panel */}
      <div style={{
        display: 'flex',
        background: 'var(--al-card2)',
        border: '1px solid rgba(var(--al-line, 232,224,204), .11)',
        borderRadius: 22, overflow: 'hidden',
      }}>
        {/* ─── MAP ─── */}
        <div style={{
          flex: 1, position: 'relative', height: 540,
          background: 'radial-gradient(circle at 44% 56%, rgba(var(--al-acct, 143,203,94), .08), transparent 62%)',
        }}>
          {/* SVG curves */}
          <svg viewBox="0 0 460 540" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {branches.map((b, i) => {
              const pos = NODE_POSITIONS[i]
              const c = getLabelHue(b.name)
              const isActive = i === selected
              return (
                <path
                  key={b.name}
                  d={branchPath(pos.x, pos.y)}
                  fill="none"
                  stroke={c}
                  strokeWidth={isActive ? 2.6 : 1.6}
                  strokeOpacity={isActive ? 0.65 : 0.28}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>

          {/* Center node */}
          <div style={{
            position: 'absolute', left: CX, top: CY, transform: 'translate(-50%,-50%)',
            width: 98, height: 98, borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 32%, #A9E07C, #6E9E3E)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 8px rgba(var(--al-acct, 143,203,94), .12), 0 12px 34px rgba(0,0,0,.45)',
            zIndex: 2,
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--al-on-accent, #14120E)">
              <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
            </svg>
            <span style={{
              fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 10, fontWeight: 600,
              lineHeight: 1, color: 'var(--al-on-accent, #14120E)', marginTop: 3,
            }}>
              Your grove
            </span>
          </div>

          {/* Branch nodes */}
          {branches.map((b, i) => {
            const pos = NODE_POSITIONS[i]
            const isActive = i === selected
            const c = getLabelHue(b.name)
            const base = nodeBase(b.count)
            const d = isActive ? base * 2 + 12 : base * 2

            return (
              <button
                key={b.name}
                onClick={() => setSelected(i)}
                style={{
                  position: 'absolute', left: pos.x, top: pos.y,
                  transform: 'translate(-50%,-50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none', cursor: 'pointer', zIndex: 2, padding: 0,
                }}
              >
                <span style={{
                  width: d, height: d, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-spectral, serif)',
                  fontSize: isActive ? 19 : 15, fontWeight: 600, lineHeight: 1,
                  transition: 'all .2s ease',
                  background: isActive ? `${c}26` : `${c}14`,
                  border: isActive ? `2.5px solid ${c}` : `1.5px solid ${c}88`,
                  color: `color-mix(in oklab, ${c} var(--al-chipmix, 52%), #241B0C)`,
                  boxShadow: isActive ? `0 0 28px ${c}66` : 'none',
                }}>
                  {b.count}
                </span>
                <span style={{
                  fontFamily: 'var(--font-instrument, sans-serif)',
                  fontSize: isActive ? 12.5 : 11, fontWeight: isActive ? 600 : 500, lineHeight: 1,
                  color: isActive ? 'var(--al-ink2)' : 'var(--al-sub)',
                  whiteSpace: 'nowrap',
                }}>
                  {shortName(b.name)}
                </span>
              </button>
            )
          })}

          {/* Footnote */}
          <p style={{
            position: 'absolute', left: 24, bottom: 18, margin: 0,
            fontFamily: 'var(--font-spectral, serif)', fontStyle: 'italic',
            fontSize: 12, lineHeight: 1.5, color: 'var(--al-mut7)',
          }}>
            Bigger nodes = more new evidence
          </p>
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div style={{
          width: 360, flexShrink: 0,
          borderLeft: '1px solid rgba(var(--al-line, 232,224,204), .1)',
          padding: '26px 26px 30px',
          background: 'var(--al-card2)',
          height: 540, overflowY: 'auto',
        }}>
          {/* Selected specialty header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: selColor, display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 11, fontWeight: 600,
              lineHeight: 1, letterSpacing: '.13em', textTransform: 'uppercase',
              color: `color-mix(in oklab, ${selColor} var(--al-chipmix, 52%), #241B0C)`,
            }}>
              {sel.name}
            </span>
          </div>

          <h3 style={{
            margin: '0 0 4px',
            fontFamily: 'var(--font-spectral, serif)', fontSize: 21, fontWeight: 600,
            lineHeight: 1.2, color: 'var(--al-ink2)',
          }}>
            {sel.count} new bottom {sel.count === 1 ? 'line' : 'lines'}
          </h3>

          {sel.connects.length > 0 && (
            <p style={{
              margin: '0 0 20px',
              fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 12.5,
              lineHeight: 1.5, color: 'var(--al-mut4)',
            }}>
              Connects to{' '}
              {sel.connects.map((name, i) => (
                <span key={name} style={{ color: `color-mix(in oklab, ${getLabelHue(name)} var(--al-chipmix, 52%), #241B0C)` }}>
                  {i > 0 ? ', ' : ''}{name}
                </span>
              ))}
            </p>
          )}

          {/* Article mini-cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sel.articles.length === 0 ? (
              <p style={{
                margin: 0,
                fontFamily: 'var(--font-spectral, serif)', fontStyle: 'italic',
                fontSize: 14, color: 'var(--al-mut3)',
              }}>
                No recent articles in this specialty.
              </p>
            ) : sel.articles.map(article => {
              const ev = getEvShort(article.strength_of_evidence)
              return (
                <Link
                  key={article.id}
                  href={`/article/${article.id}`}
                  style={{
                    display: 'block',
                    background: 'var(--al-card)',
                    border: '1px solid rgba(var(--al-line, 232,224,204), .09)',
                    borderRadius: 13, padding: '15px 16px',
                    textDecoration: 'none', transition: 'border-color .15s ease',
                  }}
                >
                  <p style={{
                    margin: '0 0 10px',
                    fontFamily: 'var(--font-spectral, serif)', fontSize: 14, fontWeight: 500,
                    lineHeight: 1.45, color: 'var(--al-ink4)',
                  }}>
                    {article.clinical_bottom_line}
                  </p>
                  <div style={{
                    fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 11,
                    lineHeight: 1, color: 'var(--al-mut4)',
                  }}>
                    <span style={{ color: `color-mix(in oklab, ${ev.c} var(--al-chipmix, 52%), #241B0C)` }}>{ev.label}</span>
                    {article.source_journal ? ` · ${article.source_journal}` : ''}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
