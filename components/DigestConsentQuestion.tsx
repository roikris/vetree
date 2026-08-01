'use client'

// Shared copy + Yes/No control for the digest marketing question. Used inline on
// the signup page (Part 2) and inside the dismissible bottom sheet (Part 3) — same
// question, same default (neither answered = NO), different surrounding chrome.
// Never render either button as pre-selected: value starts at null (untouched),
// which is treated as "No" if the caller submits without an explicit click.

export function DigestConsentQuestion({
  value,
  onChange,
}: {
  value: boolean | null
  onChange: (value: boolean) => void
}) {
  return (
    <div style={{
      background: 'var(--al-card)', border: '1px solid rgba(var(--al-line),.13)',
      borderRadius: 14, padding: '18px 20px',
    }}>
      <p style={{
        margin: '0 0 14px', font: "500 14.5px/1.5 var(--font-instrument, sans-serif)",
        color: 'var(--al-ink3)',
      }}>
        Get the weekly evidence digest — the week&apos;s new research, once, Fridays.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => onChange(true)}
          style={{
            flex: 1, padding: '11px', borderRadius: 10, cursor: 'pointer',
            font: `${value === true ? '600' : '500'} 13.5px/1 var(--font-instrument, sans-serif)`,
            background: value === true ? 'var(--al-accent)' : 'var(--al-card)',
            border: value === true ? '1.5px solid var(--al-accent)' : '1.5px solid rgba(var(--al-line),.16)',
            color: value === true ? 'var(--al-onaccent)' : 'var(--al-sub)',
            transition: 'all .15s',
          }}
        >
          Yes, send it
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          style={{
            flex: 1, padding: '11px', borderRadius: 10, cursor: 'pointer',
            font: `${value === false ? '600' : '500'} 13.5px/1 var(--font-instrument, sans-serif)`,
            background: value === false ? 'rgba(var(--al-line),.1)' : 'var(--al-card)',
            border: value === false ? '1.5px solid rgba(var(--al-line),.3)' : '1.5px solid rgba(var(--al-line),.16)',
            color: value === false ? 'var(--al-ink3)' : 'var(--al-sub)',
            transition: 'all .15s',
          }}
        >
          No thanks
        </button>
      </div>
    </div>
  )
}
