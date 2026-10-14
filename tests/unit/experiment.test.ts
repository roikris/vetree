// lib/synthesis/experiment.ts + the daily Slack reminder (.github/workflows/scripts/growth-daily-reminder.js),
// which copies its window — admin-002: the reminder still counted from run 1 ("Day 117/90").
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EXPERIMENT_KICKOFF_DATE, EXPERIMENT_END_DATE, EXPERIMENT_TOTAL_DAYS, EXPERIMENT_BASELINE_START, EXPERIMENT_BASELINE_END,
  experimentDayNumber, experimentPhase,
} from '../../lib/synthesis/experiment'
import reminder from '../../.github/workflows/scripts/growth-daily-reminder.js'

test('the reminder uses the same run-2 window and baseline as the Campaign page', () => {
  assert.equal(reminder.KICKOFF_DATE, EXPERIMENT_KICKOFF_DATE)
  assert.equal(reminder.END_DATE, EXPERIMENT_END_DATE)
  assert.equal(reminder.TOTAL_DAYS, EXPERIMENT_TOTAL_DAYS)
  assert.equal(reminder.BASELINE_START, EXPERIMENT_BASELINE_START)
  assert.equal(reminder.BASELINE_END, EXPERIMENT_BASELINE_END)
})

test('day counter: kickoff is day 1, 2026-10-14 is day 16, end is day 90, clamped both sides', () => {
  for (const [date, day] of [['2026-09-29', 1], ['2026-10-14', 16], ['2026-12-27', 90], ['2027-02-01', 90], ['2026-09-01', 1]] as const) {
    assert.equal(experimentDayNumber(date), day, date)
    assert.equal(reminder.dayNumber(date), day, `reminder ${date}`)
  }
})

test('phase: ended only from 2026-12-28 00:00 UTC', () => {
  for (const [iso, p] of [
    ['2026-09-28T23:59:59Z', 'before'], ['2026-09-29T00:00:00Z', 'running'],
    ['2026-12-27T23:59:59Z', 'running'], ['2026-12-28T00:00:00Z', 'ended'],
  ] as const) {
    assert.equal(experimentPhase(new Date(iso)), p, iso)
    assert.equal(reminder.phase(new Date(iso)), p, `reminder ${iso}`)
  }
})

const snap = (date: string, v: number) => ({ date, dau: v, mau: v * 10, registered_mau: v, median_session_duration_seconds: v * 10 })

test('message: run-2 day from the latest in-window snapshot, engaged as a run-2 total, baseline = May 21 – Jun 19 only', () => {
  const rows = [snap('2026-05-21', 10), snap('2026-06-19', 10), snap('2026-07-01', 999), snap('2026-10-13', 20)]
  const { msg, day, state } = reminder.buildMessage({ rows, engagedTotal: 7, now: new Date('2026-10-14T03:00:00Z') })
  assert.equal(state, 'running')
  assert.equal(day, 15) // latest snapshot 2026-10-13, as the Campaign page
  assert.match(msg, /Day 15\/90/)
  assert.match(msg, /7 run-2 total/)
  assert.doesNotMatch(msg, /\/day/)
  assert.match(msg, /baseline 1m 40s/) // 100 s: run-1 rows (2026-07-01) are not in the baseline
  assert.match(msg, /still include days before kickoff until 2026-10-29/)
})

test('message: a failed engaged count never reads as zero; after the end it says ended', () => {
  const rows = [snap('2026-12-27', 20)]
  const { msg, state } = reminder.buildMessage({ rows, engagedTotal: null, now: new Date('2026-12-28T03:00:00Z') })
  assert.equal(state, 'ended')
  assert.match(msg, /ended 2026-12-27/)
  assert.match(msg, /— \(count failed\) run-2 total/)
  assert.doesNotMatch(msg, /rolling windows/)
})
