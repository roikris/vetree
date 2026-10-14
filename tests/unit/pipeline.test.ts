// lib/pipeline/status.ts — the Pipeline page's rules (admin-002).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SCHEDULED_JOBS, israelSchedule, byJournal, groupSkips, byReason, ageDays, workflowUrl } from '../../lib/pipeline/status'

test('each job\'s schedule is a cron in its workflow file', () => {
  for (const job of SCHEDULED_JOBS) {
    const yml = readFileSync(`.github/workflows/${job.workflow}`, 'utf8')
    const cron = `${job.utc.minute} ${job.utc.hour} * * ${job.utc.weekday ?? '*'}`
    assert.ok(yml.includes(`cron: '${cron}'`), `${job.workflow} has no cron '${cron}'`)
  }
  assert.equal(workflowUrl('daily-sync.yml'), 'https://github.com/roikris/vetree/actions/workflows/daily-sync.yml')
})

test('schedules in Israel time follow summer / winter time', () => {
  const sync = SCHEDULED_JOBS.find(j => j.key === 'sync')!
  const digest = SCHEDULED_JOBS.find(j => j.key === 'digest')!
  assert.equal(israelSchedule(sync, new Date('2026-10-14T12:00:00Z')), 'daily 09:00')   // IDT, UTC+3
  assert.equal(israelSchedule(sync, new Date('2026-11-14T12:00:00Z')), 'daily 08:00')   // IST, UTC+2
  assert.equal(israelSchedule(digest, new Date('2026-10-14T12:00:00Z')), 'Friday 13:00')
})

test('articles added today, by journal: most first, ties by name, blanks grouped', () => {
  assert.deepEqual(byJournal([
    { source_journal: 'JAVMA' }, { source_journal: 'Vet Surg' }, { source_journal: 'JAVMA' },
    { source_journal: null }, { source_journal: '  ' }, { source_journal: 'AJVR' },
  ]), [
    { journal: '(no journal)', count: 2 }, { journal: 'JAVMA', count: 2 },
    { journal: 'AJVR', count: 1 }, { journal: 'Vet Surg', count: 1 },
  ])
})

test('skips: grouped by reason with up to 3 samples, PubMed link when there is no URL', () => {
  const row = (reason: string | null, i: number, url: string | null = null) =>
    ({ reason, journal: 'J', title: i === 0 ? null : `T${i}`, article_url: url, pubmed_id: `${100 + i}` })
  const groups = groupSkips([row('no_abstract', 0), row('no_abstract', 1, 'https://x/1'), row('no_abstract', 2), row('no_abstract', 3), row('blacklisted', 4), row(null, 5)])
  assert.deepEqual(groups.map(g => [g.reason, g.count, g.samples.length]), [['no_abstract', 4, 3], ['blacklisted', 1, 1], ['unknown', 1, 1]])
  assert.deepEqual(groups[0].samples[0], { title: 'PMID 100', url: 'https://pubmed.ncbi.nlm.nih.gov/100/' })
  assert.deepEqual(groups[0].samples[1], { title: 'T1', url: 'https://x/1' })
})

test('hidden by reason: a quarantine without a reason is never dropped', () => {
  assert.deepEqual(byReason([{ quarantine_reason: 'ai_refused' }, { quarantine_reason: null }, { quarantine_reason: 'ai_refused' }]),
    [{ reason: 'ai_refused', count: 2 }, { reason: 'unknown / legacy', count: 1 }])
})

test('age in whole days; none for a missing or broken timestamp', () => {
  const now = new Date('2026-10-14T12:00:00Z')
  assert.equal(ageDays('2026-10-11T13:00:00Z', now), 2)
  assert.equal(ageDays('2026-10-14T11:00:00Z', now), 0)
  assert.equal(ageDays(null, now), null)
  assert.equal(ageDays('nope', now), null)
})
