// growth-005: the December trial's analysis (lib/growth/trialAnalysis.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { channelOf, arrivalsOf, postOutcomes, attributeSignups, compareArms, analyzeTrial, type ViewIn } from '../../lib/growth/trialAnalysis'

const view = (o: Partial<ViewIn> & { created_at: string }): ViewIn => ({
  path: '/article/a1', session_id: null, ip_hash: null, user_id: null, utm_source: null, utm_medium: null, utm_campaign: null,
  referrer: null, duration_seconds: null, ...o,
})

test('channels: organic only; Facebook IL / Intl by campaign', () => {
  assert.equal(channelOf({ utm_source: 'linkedin', utm_medium: 'social', utm_campaign: null }), 'linkedin')
  assert.equal(channelOf({ utm_source: 'linkedin', utm_medium: 'paid-social', utm_campaign: null }), null)
  assert.equal(channelOf({ utm_source: 'facebook', utm_medium: 'social', utm_campaign: 'il' }), 'facebook_il')
  assert.equal(channelOf({ utm_source: 'facebook', utm_medium: 'social', utm_campaign: 'intl-trial-20261203' }), 'facebook_intl')
  assert.equal(channelOf({ utm_source: 'facebook', utm_medium: 'social', utm_campaign: null }), null)
})

test('arrivals: first view of a session per source; Google by referrer', () => {
  const a = arrivalsOf([
    view({ created_at: '2026-12-03T08:00:00Z', session_id: 's1', utm_source: 'whatsapp', utm_medium: 'social', duration_seconds: 40 }),
    view({ created_at: '2026-12-03T08:01:00Z', session_id: 's1', utm_source: 'whatsapp', utm_medium: 'social', path: '/article/a2' }),
    view({ created_at: '2026-12-03T09:00:00Z', session_id: 's2', referrer: 'https://www.google.com/' }),
    view({ created_at: '2026-12-03T09:00:00Z', session_id: 's3' }),
  ])
  assert.equal(a.length, 2)
  assert.deepEqual(a.map(x => [x.source, x.article, x.engaged]), [['whatsapp', 'a1', true], ['google', 'a1', false]])
})

test('posts: December by token (exactly one post), baseline by article + 7 days (latest wins, ambiguity counted), zeros kept, maturing flagged', () => {
  const now = new Date('2026-12-20T00:00:00Z')
  const approvals = [
    { id: 'b1', article_id: 'a1', platform: 'whatsapp', created_at: '2026-11-01T06:00:00Z' },
    { id: 'b2', article_id: 'a1', platform: 'whatsapp', created_at: '2026-11-03T06:00:00Z' },
    { id: 'b3', article_id: 'a9', platform: 'linkedin', created_at: '2026-11-05T06:00:00Z' },
    { id: 't1', article_id: 'a5', platform: 'linkedin', created_at: '2026-12-03T06:00:00Z' },
    { id: 't2', article_id: 'a6', platform: 'linkedin', created_at: '2026-12-18T06:00:00Z' },
    { id: 'x1', article_id: 'a7', platform: 'facebook_intl', created_at: '2026-12-04T06:00:00Z' },
  ]
  const tr = (id: string, date: string) => ({ approval_id: id, platform: 'linkedin', trial_date: date, variant: 'in_post', utm_campaign: `trial-${date.replaceAll('-', '')}`, char_count: 900, ends_with_question: true, li_comments: null, li_comments_age_hours: null, li_impressions: null, li_impressions_age_hours: null })
  const trialRows = [tr('t1', '2026-12-03'), tr('t2', '2026-12-18')]
  const arrivals = arrivalsOf([
    view({ created_at: '2026-11-04T10:00:00Z', session_id: 'v1', utm_source: 'whatsapp', utm_medium: 'social' }), // b1 + b2 eligible → b2
    view({ created_at: '2026-12-04T10:00:00Z', session_id: 'v2', utm_source: 'linkedin', utm_medium: 'social', utm_campaign: 'trial-20261203', path: '/article/zzz' }), // token → t1 even on another page
    view({ created_at: '2026-12-20T10:00:00Z', session_id: 'v3', utm_source: 'linkedin', utm_medium: 'social', utm_campaign: 'trial-20261203' }), // after 7 days → none
  ])
  const { posts, ambiguous } = postOutcomes({ now, approvals, trialRows }, arrivals)
  const by = Object.fromEntries(posts.map(p => [p.approval_id, p]))
  assert.equal(by.b1.visits, 0)
  assert.equal(by.b2.visits, 1)
  assert.equal(ambiguous, 1)
  assert.equal(by.b3.visits, 0) // zero-visit post still counted
  assert.equal(by.t1.visits, 1)
  assert.equal(by.t2.mature, false)
  assert.equal(by.x1.trial, false) // a December approval without a trial row = outside the trial
})

test('signups: bridged by the account\'s own network address, first touch, ambiguity flagged', () => {
  const views = [
    view({ created_at: '2026-12-05T10:00:00Z', session_id: 'a', ip_hash: 'h1', utm_source: 'whatsapp', utm_medium: 'social' }),
    view({ created_at: '2026-12-05T11:00:00Z', session_id: 'b', ip_hash: 'h1', referrer: 'https://www.google.co.il/' }),
    view({ created_at: '2026-12-05T12:05:00Z', session_id: 'c', ip_hash: 'h1', user_id: 'u1' }),
  ]
  const [s] = attributeSignups([{ id: 'u1', created_at: '2026-12-05T12:00:00Z' }], views, arrivalsOf(views))
  assert.equal(s.source, 'whatsapp')
  assert.equal(s.ambiguous, true)
  const [none] = attributeSignups([{ id: 'u2', created_at: '2026-12-05T12:00:00Z' }], views, arrivalsOf(views))
  assert.equal(none.source, 'unattributed')
})

test('splits: too few below 8 per arm; a big real difference is detected; equal arms are not', () => {
  const obs = (n: number, v: (i: number) => number) => Array.from({ length: n }, (_, i) => ({ date: `2026-12-${String(1 + (i % 28)).padStart(2, '0')}`, value: v(i) }))
  assert.equal(compareArms({ name: 'a', obs: obs(5, () => 1) }, { name: 'b', obs: obs(9, () => 3) }).verdict, 'too_few')
  const big = compareArms({ name: 'a', obs: obs(15, i => i % 3) }, { name: 'b', obs: obs(15, i => 6 + (i % 3)) })
  assert.equal(big.verdict, 'difference')
  assert.ok(big.p !== null && big.p < 0.05)
  const same = compareArms({ name: 'a', obs: obs(12, i => i % 4) }, { name: 'b', obs: obs(12, i => (i + 1) % 4) })
  assert.equal(same.verdict, 'no_clear_difference')
})

test('analyzeTrial runs end to end on empty input', () => {
  const r = analyzeTrial({ now: new Date('2026-12-10T00:00:00Z'), approvals: [], trialRows: [], views: [], events: [], signups: [], scores: new Map(), labels: new Map(), linkedinDaily: [] })
  assert.equal(r.splits.whatsapp_visits.verdict, 'too_few')
  assert.equal(r.scorecard.length, 10)
})

test('review r1: two tagged links in one tab are two arrivals; a preview visit before the post never counts', () => {
  const a = arrivalsOf([
    view({ created_at: '2026-12-01T09:00:00Z', session_id: 's', utm_source: 'linkedin', utm_medium: 'social', utm_campaign: 'trial-20261201' }),
    view({ created_at: '2026-12-01T09:05:00Z', session_id: 's', utm_source: 'linkedin', utm_medium: 'social', utm_campaign: 'trial-20261201', path: '/article/b' }),
    view({ created_at: '2026-12-02T09:00:00Z', session_id: 's', utm_source: 'linkedin', utm_medium: 'social', utm_campaign: 'trial-20261202' }),
    view({ created_at: '2026-11-23T09:00:00Z', session_id: 'p', utm_source: 'linkedin', utm_medium: 'social', utm_campaign: 'trial-20261201' }),
  ])
  assert.equal(a.length, 3)
  const tr = (id: string, date: string) => ({ approval_id: id, platform: 'linkedin', trial_date: date, variant: 'in_post', utm_campaign: null, char_count: null, ends_with_question: null, li_comments: null, li_comments_age_hours: null, li_impressions: null, li_impressions_age_hours: null })
  const { posts } = postOutcomes({
    now: new Date('2026-12-20T00:00:00Z'),
    approvals: [
      { id: 'd1', article_id: 'a1', platform: 'linkedin', created_at: '2026-12-01T06:00:00Z' },
      { id: 'd2', article_id: 'a2', platform: 'linkedin', created_at: '2026-12-02T06:00:00Z' },
    ],
    trialRows: [tr('d1', '2026-12-01'), tr('d2', '2026-12-02')],
  }, a)
  assert.deepEqual(posts.map(p => [p.approval_id, p.visits]), [['d1', 1], ['d2', 1]])
})

test('review r1: a Dec 31 arrival signing up on Jan 1 counts for December', () => {
  const views = [
    view({ created_at: '2026-12-31T20:00:00Z', session_id: 'a', ip_hash: 'h', utm_source: 'whatsapp', utm_medium: 'social' }),
    view({ created_at: '2027-01-01T08:05:00Z', session_id: 'b', ip_hash: 'h', user_id: 'u' }),
  ]
  const r = analyzeTrial({ now: new Date('2027-01-09T00:00:00Z'), approvals: [], trialRows: [], views, events: [], signups: [{ id: 'u', created_at: '2027-01-01T08:00:00Z' }], scores: new Map(), labels: new Map(), linkedinDaily: [] })
  assert.equal(r.scorecard.find(x => x.channel === 'whatsapp' && x.period === 'trial')!.signups, 1)
  assert.equal(r.funnel.find(f => f.source === 'whatsapp')!.signups, 1)
})
