type SproutLoaderProps = {
  /** 'growing' animates seed → sprout → leaf; 'resting' shows the sprout; 'done' shows the leaf */
  state: 'growing' | 'resting' | 'done'
  label: string
  /** When false the label is visually hidden (still read by screen readers) */
  showLabel?: boolean
}

/**
 * Vetree's search loader: a seed buried in the soil sends down a root, pushes a shoot through
 * the surface, unfolds two seed leaves and opens into the Vetree leaf; then fades back to the
 * buried seed and grows again (3.4 s). 'done' grows once and stays; 'resting' is a still
 * seedling. Design approved by the owner from a side-by-side preview, 2026-09-28.
 * Decorative SVG (aria-hidden); the label is the accessible status text and should be placed
 * in a role="status" region by the caller, outside any aria-busy subtree. With
 * prefers-reduced-motion the animation is replaced by the static stage (app/globals.css).
 */
export function SproutLoader({ state, label, showLabel = true }: SproutLoaderProps) {
  return (
    <div
      className={`sprout-loader sprout-${state}`}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 0' }}
    >
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        {/* ground in cross-section: a soft soil patch, the seed buried inside it */}
        <defs>
          <radialGradient
            id="vt-sprout-soil" cx="32" cy="45" r="22" gradientUnits="userSpaceOnUse"
            gradientTransform="translate(0 45) scale(1 .62) translate(0 -45)"
          >
            <stop offset="0" stopColor="var(--al-mut6)" stopOpacity=".3" />
            <stop offset=".65" stopColor="var(--al-mut6)" stopOpacity=".14" />
            <stop offset="1" stopColor="var(--al-mut6)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M7 46.5 Q32 43.2 57 46.5 L57 60 L7 60 Z" fill="url(#vt-sprout-soil)" />
        <path d="M7 46.5 Q32 43.2 57 46.5" fill="none" stroke="var(--al-mut6)" strokeWidth="1.6" strokeLinecap="round" opacity=".65" />
        {/* seed (stays buried through the loop) */}
        <g transform="rotate(-18 32 53)">
          <ellipse className="sprout-seed" cx="32" cy="53" rx="4.4" ry="3.1" fill="var(--al-accent)" opacity=".9" />
        </g>
        {/* the plant: root, stem breaking the surface, two seed leaves, the Vetree leaf */}
        <g className="sprout-plant">
          <path className="sprout-root" d="M32.6 55.6 C33.4 57.6 32.2 58.8 33.1 60.6" fill="none" stroke="var(--al-accent)" strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
          <path className="sprout-stem" d="M32 51.5 C31.3 43 31 35 33 24" fill="none" stroke="var(--al-accent)" strokeWidth="2.4" strokeLinecap="round" />
          <g className="sprout-cot-l">
            <path transform="translate(31.5 38) scale(1.35) translate(-31.6 -41)" d="M31.6 41 C27.2 40.6 24.6 37.8 24.9 35 C28.8 35.1 31.1 37.7 31.6 41 Z" fill="var(--al-accent)" opacity=".85" />
          </g>
          <g className="sprout-cot-r">
            <path transform="translate(31.8 35.6) scale(1.35) translate(-32 -38.5)" d="M32 38.5 C35.8 36.8 39.2 37.1 40.8 39.4 C37.9 41.5 34.2 41.1 32 38.5 Z" fill="var(--al-accent)" opacity=".85" />
          </g>
          <g className="sprout-leaf">
            <path
              transform="translate(28.5 3.4) scale(.95)"
              fill="var(--al-accent)"
              d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"
            />
          </g>
        </g>
      </svg>
      <span
        className={showLabel ? undefined : 'sr-only'}
        style={{ fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 13, color: 'var(--al-mut3)' }}
      >
        {label}
      </span>
    </div>
  )
}
