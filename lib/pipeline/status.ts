// The Pipeline page's rules (admin-002): which scheduled jobs it watches, how "today" and the
// skipped-article groups are built. Pure — the route (app/api/admin/pipeline/status) does the reads.
//
// Nothing here is a job-health verdict: the jobs don't store their run summaries (their Slack
// messages are built at run time), and a sync that finds nothing new leaves no trace. The page shows
// the latest activity each job left in the database, next to its schedule and its GitHub run history.

import { israelDate } from '@/lib/growth/daily'

const REPO_ACTIONS = 'https://github.com/roikris/vetree/actions/workflows'

export type ScheduledJob = {
  key: 'sync' | 'enrichment' | 'snapshot' | 'digest' | 'security'
  name: string
  /** UTC schedule from the workflow's cron */
  utc: { hour: number; minute: number; weekday?: number } // weekday: 0 = Sunday
  workflow: string
  /** what the latest-activity time is taken from */
  activity: string
}

// The crons in .github/workflows/*.yml (tests/unit/pipeline.test.ts checks them against the files)
export const SCHEDULED_JOBS: ScheduledJob[] = [
  { key: 'sync', name: 'Daily sync (PubMed)', utc: { hour: 6, minute: 0 }, workflow: 'daily-sync.yml', activity: 'newest article added' },
  { key: 'enrichment', name: 'Enrichment', utc: { hour: 7, minute: 0 }, workflow: 'enrich-articles.yml', activity: 'latest enrichment attempt' },
  { key: 'snapshot', name: 'Analytics snapshot', utc: { hour: 2, minute: 0 }, workflow: 'analysis-agent.yml', activity: 'newest snapshot date' },
  { key: 'digest', name: 'Weekly digest', utc: { hour: 10, minute: 0, weekday: 5 }, workflow: 'weekly-digest.yml', activity: 'latest digest run' },
  { key: 'security', name: 'Security scan', utc: { hour: 19, minute: 0, weekday: 4 }, workflow: 'security-agent.yml', activity: 'latest scan' },
]

export const workflowUrl = (file: string) => `${REPO_ACTIONS}/${file}`

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "daily 09:00" / "Friday 13:00" in Israel time on the given day (summer / winter time included) */
export function israelSchedule(job: ScheduledJob, on: Date): string {
  const d = new Date(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate(), job.utc.hour, job.utc.minute))
  const time = hhmm.format(d)
  return job.utc.weekday === undefined ? `daily ${time}` : `${WEEKDAYS[job.utc.weekday]} ${time}`
}

/** Articles added today, by journal, most first (ties by name) */
export function byJournal(rows: { source_journal: string | null }[]): { journal: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const j = r.source_journal?.trim() || '(no journal)'
    counts.set(j, (counts.get(j) ?? 0) + 1)
  }
  return [...counts].map(([journal, count]) => ({ journal, count }))
    .sort((a, b) => b.count - a.count || a.journal.localeCompare(b.journal))
}

export type SkipRow = { reason: string | null; journal: string | null; title: string | null; article_url: string | null; pubmed_id: string | null }
export type SkipGroup = { reason: string; count: number; samples: { title: string; url: string | null }[] }

/** The latest sync's recorded skips, grouped by reason, a few samples each (only blacklisted and no-abstract skips are recorded) */
export function groupSkips(rows: SkipRow[], samplesPerReason = 3): SkipGroup[] {
  const groups = new Map<string, SkipGroup>()
  for (const r of rows) {
    const reason = r.reason || 'unknown'
    const g = groups.get(reason) ?? { reason, count: 0, samples: [] }
    g.count++
    if (g.samples.length < samplesPerReason) {
      g.samples.push({
        title: r.title?.trim() || (r.pubmed_id ? `PMID ${r.pubmed_id}` : '(untitled)'),
        url: r.article_url || (r.pubmed_id ? `https://pubmed.ncbi.nlm.nih.gov/${r.pubmed_id}/` : null),
      })
    }
    groups.set(reason, g)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
}

/** Hidden articles by quarantine reason; a quarantine with no reason is "unknown / legacy" */
export function byReason(rows: { quarantine_reason: string | null }[]): { reason: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const reason = r.quarantine_reason || 'unknown / legacy'
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  return [...counts].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
}

/** Whole days from an instant to now (for "waiting 3 days") — null when there's no instant */
export function ageDays(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now.getTime() - t) / 86_400_000))
}

export { israelDate }
