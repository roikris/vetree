type SproutLoaderProps = {
  /** 'growing' animates seed → sprout → leaf; 'resting' shows the sprout; 'done' shows the leaf */
  state: 'growing' | 'resting' | 'done'
  label: string
  /** When false the label is visually hidden (still read by screen readers) */
  showLabel?: boolean
}

/**
 * Vetree's search loader: a seed that sprouts and opens into the Vetree leaf.
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
      <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        {/* soil line */}
        <path d="M10 40h28" stroke="var(--al-mut6)" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
        {/* stage 1: seed */}
        <g className="sprout-stage sprout-seed">
          <ellipse cx="24" cy="36.5" rx="4.2" ry="2.8" fill="var(--al-accent)" />
        </g>
        {/* stage 2: sprout — stem and two seed leaves */}
        <g className="sprout-stage sprout-sprout" fill="none" stroke="var(--al-accent)" strokeWidth="2" strokeLinecap="round">
          <path d="M24 39V27" />
          <path d="M24 29c-1.5-4.6-5.4-6.4-9-5.6 1 3.9 4.9 6.3 9 5.6z" fill="var(--al-accent)" />
          <path d="M24 27c1.3-4.3 5-6 8.4-5.2-.9 3.6-4.6 5.9-8.4 5.2z" fill="var(--al-accent)" />
        </g>
        {/* stage 3: the Vetree leaf */}
        <g className="sprout-stage sprout-leaf" transform="translate(12 10) scale(1)">
          <path
            fill="var(--al-accent)"
            d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"
          />
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
