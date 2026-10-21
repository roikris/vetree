// lib/growth/passedOver.ts — resting recommendations shown on 3 days without action (growth-003).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restingPassedOver } from '../../lib/growth/passedOver'

// Noon in Israel on a date (IDT, UTC+3, in October 2026)
const at = (date: string, hh = '09') => `${date}T${hh}:00:00Z`
const set = (date: string, ...ids: string[]) => ({ served_at: at(date), article_ids: ids })
const now = (date: string) => Date.parse(at(date))

test('shown on 3 earlier days → rests from the next day for 14 days', () => {
  const sets = [set('2026-10-01', 'a'), set('2026-10-02', 'a'), set('2026-10-03', 'a')]
  assert.equal(restingPassedOver(sets, now('2026-10-04')).has('a'), true)
  assert.equal(restingPassedOver(sets, now('2026-10-17')).has('a'), true)   // day 14
  assert.equal(restingPassedOver(sets, now('2026-10-18')).has('a'), false)  // back
})

test('2 days is not enough; several loads on one day count once', () => {
  const sets = [set('2026-10-01', 'a'), { served_at: at('2026-10-01', '15'), article_ids: ['a'] }, set('2026-10-02', 'a')]
  assert.equal(restingPassedOver(sets, now('2026-10-05')).size, 0)
})

test("today's showings never count, so reloading today keeps today's list", () => {
  const sets = [set('2026-10-01', 'a'), set('2026-10-02', 'a'), set('2026-10-03', 'a')]
  assert.equal(restingPassedOver(sets, now('2026-10-03')).has('a'), false)
})

test('Israel day, not UTC: 22:30 UTC is already the next Israel day', () => {
  // 2026-10-01 22:30 UTC = 2026-10-02 01:30 IDT → same Israel day as the 10-02 set
  const sets = [set('2026-10-01', 'a'), { served_at: '2026-10-01T22:30:00Z', article_ids: ['a'] }, set('2026-10-02', 'a')]
  assert.equal(restingPassedOver(sets, now('2026-10-05')).size, 0)
})

test('after its rest it is counted afresh: 3 new days → rests again', () => {
  const first = [set('2026-10-01', 'a'), set('2026-10-02', 'a'), set('2026-10-03', 'a')]
  const back = [set('2026-10-18', 'a'), set('2026-10-19', 'a')]
  assert.equal(restingPassedOver([...first, ...back], now('2026-10-20')).has('a'), false)
  assert.equal(restingPassedOver([...first, ...back, set('2026-10-20', 'a')], now('2026-10-21')).has('a'), true)
})

test('days shown during a rest (older data) do not count toward the next rest', () => {
  const sets = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'].map(d => set(d, 'a'))
  // rest 10-04..10-17; 10-04..10-06 are ignored, so nothing new is counted → free from 10-18
  assert.equal(restingPassedOver(sets, now('2026-10-18')).has('a'), false)
})

test('each article on its own', () => {
  const sets = [set('2026-10-01', 'a', 'b'), set('2026-10-02', 'a', 'b'), set('2026-10-03', 'a')]
  const r = restingPassedOver(sets, now('2026-10-04'))
  assert.deepEqual([...r], ['a'])
})
