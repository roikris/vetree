export function DisclaimerBanner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '11px 16px', marginBottom: 20,
      background: 'rgba(var(--al-line), .05)',
      border: '1px solid rgba(var(--al-line), .1)',
      borderRadius: 10,
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--al-mut4)', flexShrink: 0, marginTop: 1 }}>
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
      </svg>
      <p style={{ margin: 0, font: "400 13px/1.55 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)' }}>
        AI-generated summaries — verify critical details with primary literature before clinical use.
      </p>
    </div>
  )
}
