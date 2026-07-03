export function DisclaimerBanner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', marginBottom: 20,
      background: 'rgba(var(--al-warnc), .10)',
      border: '1px solid rgba(var(--al-warnc), .28)',
      borderRadius: 8,
      borderLeft: '3px solid rgba(var(--al-warnc), .65)',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--al-warntext)', flexShrink: 0, marginTop: 1 }}>
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
      </svg>
      <p style={{ margin: 0, font: "500 13px/1.5 var(--font-instrument, sans-serif)", color: 'var(--al-warntext)', letterSpacing: '0.01em' }}>
        <span style={{ fontFamily: 'var(--font-spectral, serif)', fontWeight: 600, fontSize: 13, marginRight: 4 }}>Disclaimer:</span>
        AI-generated summaries may contain errors. Verify critical details against primary literature before clinical use.
      </p>
    </div>
  )
}
