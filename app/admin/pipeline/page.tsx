import { PipelineStatus } from './PipelineStatus'

// Pipeline (admin-002, Roi 2026-10-14: "an extension of the Slack messages with further elaboration").
// Article Health, Incomplete Enrichment, the diagnostics page and the old stats cards were removed: the daily
// enrichment job now retries, hides on the third failure and parks refusals for the Codex fallback itself.
export default function AdminPipelinePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--al-bg)', padding: '36px 36px 80px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          margin: '0 0 6px',
          fontFamily: 'var(--font-spectral, serif)', fontSize: 28, fontWeight: 600,
          lineHeight: 1.1, color: 'var(--al-ink2)', letterSpacing: '-.01em',
        }}>
          Pipeline
        </h1>
        <p style={{
          margin: 0,
          fontFamily: 'var(--font-spectral, serif)', fontStyle: 'italic', fontSize: 14, fontWeight: 400,
          color: 'var(--al-mut3)', lineHeight: 1.4,
        }}>
          What needs you, today&apos;s sync, and each job&apos;s latest trace — the daily Slack messages, expanded.
        </p>
      </div>
      <PipelineStatus />
    </div>
  )
}
