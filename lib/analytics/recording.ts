/**
 * Analytics recording rules shared by every writer (/api/analytics/track, /search, /event, the
 * synthesis generate and feedback routes).
 *
 * Preview deployments and local dev share the PRODUCTION database, so they must never write
 * analytics: only the production deployment records. (Before 2026-09-29 CI smoke runs on previews
 * and local Playwright runs were counted as real synthesis runs and inflated page-view charts.)
 */
export function analyticsRecordingEnabled(): boolean {
  return process.env.VERCEL_ENV === 'production'
}

/** Deliberate internal smoke-test traffic (Playwright tags every request) — never recorded */
export function isQATraffic(userAgent: string, headers: Headers): boolean {
  return userAgent.includes('VetreeQABot') || headers.get('x-qa-bot') === '1'
}

/** Synthesis experiment events (analytics_events.event_name). Never page_views (CLAUDE.md rule 12). */
export const SYNTHESIS_EVENTS = [
  'synthesis_attempt', 'synthesis_run', 'synthesis_blocked', 'synthesis_insufficient',
  'synthesis_failed', 'synthesis_engaged', 'synthesis_busy_timeout', 'synthesis_client_error',
] as const
export type SynthesisEvent = (typeof SYNTHESIS_EVENTS)[number]

export function isSynthesisEvent(name: unknown): name is SynthesisEvent {
  return typeof name === 'string' && (SYNTHESIS_EVENTS as readonly string[]).includes(name)
}
