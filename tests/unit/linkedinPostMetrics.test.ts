// lib/linkedin/postMetrics.ts — per-post numbers keep the highest export value + its range (analytics-002).
// Run: npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportPeriod, mergeMetric, undercountReason } from '../../lib/linkedin/postMetrics'

const WEEK = { start: '2026-11-16', end: '2026-11-22' }

test('export period = first and last daily row', () => {
  assert.deepEqual(exportPeriod(['2026-11-18', '2026-11-16', 'x', '2026-11-22']), WEEK)
  assert.equal(exportPeriod([]), null)
})

test('a quiet week never overwrites a bigger number (the 06-11 post)', () => {
  const stored = { value: 9375, start: '2026-06-01', end: '2026-12-31' }
  assert.deepEqual(mergeMetric(stored, 4, WEEK), { ...stored, changed: false })
})

test('a bigger number replaces, with its range', () => {
  assert.deepEqual(mergeMetric({ value: 4, start: null, end: null }, 9375, WEEK), { value: 9375, ...WEEK, changed: true })
})

test('first value; missing incoming keeps stored; equal keeps stored range', () => {
  assert.deepEqual(mergeMetric(null, 10, WEEK), { value: 10, ...WEEK, changed: true })
  assert.deepEqual(mergeMetric({ value: 7, start: null, end: null }, null, WEEK), { value: 7, start: null, end: null, changed: false })
  assert.deepEqual(mergeMetric({ value: 7, start: '2026-11-01', end: '2026-11-07' }, 7, WEEK).start, '2026-11-01')
  assert.deepEqual(mergeMetric({ value: null, start: null, end: null }, 0, null), { value: 0, start: null, end: null, changed: true })
})

test('undercount: unknown range, range after the launch week, covered', () => {
  assert.equal(undercountReason('2026-06-11', { value: 4, start: null, end: null }), 'unknown_range')
  assert.equal(undercountReason('2026-06-11', { value: 4, ...WEEK }), 'missed_launch')
  assert.equal(undercountReason('2026-11-16', { value: 40, ...WEEK }), null)
  assert.equal(undercountReason('2026-11-10', { value: 40, ...WEEK }), null) // range starts on day 7
  assert.equal(undercountReason('2026-11-09', { value: 40, ...WEEK }), 'missed_launch') // starts on day 8
  assert.equal(undercountReason('2026-11-09', { value: null, start: null, end: null }), null)
})
