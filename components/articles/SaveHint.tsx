'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Caveat } from 'next/font/google'

// Handwritten font, only for this hint: not preloaded, so other pages never fetch it
const hand = Caveat({ subsets: ['latin'], weight: '600', preload: false, display: 'swap' })

// Readers who arrive from the Facebook IL Page button (vetree.app/il → app/il/route.ts tags the visit
// utm_content=page-button, social-001) get a handwritten "save it" with an arrow pointing up at the Save button,
// circled by slim rays like a child's drawing of the sun. Shown only to them, never once the article is saved, gone
// after 15 seconds; it never blocks a click. Its colour stands out from the page in both themes (orange / amber).
const fromPageButton = () => new URLSearchParams(window.location.search).get('utm_content') === 'page-button'
const noSubscribe = () => () => {}
const SHOWN_MS = 15_000

// 12 rays around the label, slightly uneven in angle and length — drawn by hand, not by a compass
const RAYS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * 2 * Math.PI + [0.06, -0.08, 0.04, -0.03, 0.09, -0.05][i % 6]
  const len = [9, 12, 8, 11, 10, 13][i % 6]
  const [cx, cy, rx, ry] = [80, 40, 50, 25]
  const x1 = cx + Math.cos(a) * rx, y1 = cy + Math.sin(a) * ry
  const x2 = cx + Math.cos(a) * (rx + len), y2 = cy + Math.sin(a) * (ry + len * 0.75)
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`
})

export function SaveHint({ saved }: { saved: boolean }) {
  // false on the server and on the first client render (no hydration mismatch), the URL's answer after that
  const arrived = useSyncExternalStore(noSubscribe, fromPageButton, () => false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!arrived) return
    const t = setTimeout(() => setGone(true), SHOWN_MS)
    return () => clearTimeout(t)
  }, [arrived])

  if (!arrived || gone || saved) return null

  return (
    <div
      aria-hidden="true"
      className="vt-savehint"
      style={{
        position: 'absolute', top: 'calc(100% + 2px)', right: 'calc(100% - 30px)', width: 118,
        pointerEvents: 'none', color: 'var(--vt-hint)', zIndex: 30,
      }}
    >
      <style>{`
        .vt-savehint { --vt-hint: #E8590C; animation: vt-hint-out .6s ease-in 14.4s forwards; }
        .dark .vt-savehint { --vt-hint: #FFB547; }
        .vt-savehint .vt-arrow { stroke-dasharray: 90; stroke-dashoffset: 90; animation: vt-hint-draw .8s ease-out .3s forwards; }
        .vt-savehint .vt-hint-text { opacity: 0; transform: rotate(-6deg) translateY(4px); animation: vt-hint-in .45s ease-out .9s forwards; }
        .vt-savehint .vt-rays { transform-origin: 80px 40px; animation: vt-rays-pulse 1.6s ease-in-out 1.9s infinite; }
        .vt-savehint .vt-rays path { stroke-dasharray: 16; stroke-dashoffset: 16; animation: vt-hint-draw .5s ease-out forwards; }
        @keyframes vt-hint-draw { to { stroke-dashoffset: 0; } }
        @keyframes vt-hint-in { to { opacity: 1; transform: rotate(-6deg) translateY(0); } }
        @keyframes vt-rays-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.12); opacity: .55; } }
        @keyframes vt-hint-out { to { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .vt-savehint, .vt-savehint .vt-arrow, .vt-savehint .vt-hint-text, .vt-savehint .vt-rays, .vt-savehint .vt-rays path { animation: none; }
          .vt-savehint .vt-arrow, .vt-savehint .vt-rays path { stroke-dashoffset: 0; }
          .vt-savehint .vt-hint-text { opacity: 1; transform: rotate(-6deg); }
        }
      `}</style>
      {/* a wobbly hand-drawn arrow curving up to the button */}
      <svg width="64" height="44" viewBox="0 0 64 44" fill="none" style={{ display: 'block', marginLeft: 'auto' }}>
        <path
          className="vt-arrow"
          d="M 14 40 C 22 34, 30 30, 34 22 C 38 14, 42 10, 46 4 M 46 4 L 38 7 M 46 4 L 46 12"
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
      <div style={{ position: 'relative', width: 'fit-content', marginTop: -4 }}>
        {/* the sun's rays, centred on the label, each drawn in a moment after the last */}
        <svg
          width="160" height="80" viewBox="0 0 160 80" fill="none"
          style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', overflow: 'visible' }}
        >
          <g className="vt-rays">
            {RAYS.map((d, i) => (
              <path key={i} d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                style={{ animationDelay: `${1.2 + i * 0.05}s` }} />
            ))}
          </g>
        </svg>
        <div
          className={`vt-hint-text ${hand.className}`}
          // a paper-coloured patch keeps it readable over whatever is beneath (tags, the title)
          style={{
            position: 'relative', fontSize: 24, lineHeight: 1, whiteSpace: 'nowrap',
            padding: '2px 8px 4px', borderRadius: 8, background: 'var(--al-bg)',
            boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
          }}
        >
          save it
        </div>
      </div>
    </div>
  )
}
