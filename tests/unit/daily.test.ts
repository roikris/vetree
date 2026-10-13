// lib/growth/daily.ts — the daily-posts rules (growth-002).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  POSTING_PLATFORMS, GENERATED_PLATFORMS, telegramFromWhatsapp, israelDate, israelDayBounds, israelDateMinus,
  postingStreak, reconcileDay, postedPlatforms, type ApprovedRow,
} from '../../lib/growth/daily'

test('the posting set (Roi, 2026-10-13): six platforms, no Instagram, Telegram derived from WhatsApp', () => {
  assert.deepEqual(POSTING_PLATFORMS.map(p => p.platform), ['facebook_il', 'whatsapp', 'telegram', 'linkedin', 'facebook_intl', 'twitter'])
  assert.deepEqual(GENERATED_PLATFORMS.map(p => p.platform), ['facebook_il', 'whatsapp', 'linkedin', 'facebook_intl', 'twitter'])
  assert.equal(POSTING_PLATFORMS.find(p => p.platform === 'telegram')?.language, 'he')
})

test('Telegram = WhatsApp with every utm_source switched, nothing else touched', () => {
  const wa = 'ממצא\n\n📄 Title\n🔗 https://vetree.app/article/a?utm_source=whatsapp&utm_medium=social\n💾 שמרו: https://vetree.app/article/a?utm_source=whatsapp&utm_medium=social&intent=save&utm_content=save-line'
  const tg = telegramFromWhatsapp(wa)
  assert.equal(tg, wa.replaceAll('utm_source=whatsapp', 'utm_source=telegram'))
  assert.equal(tg.includes('whatsapp'), false)
  assert.equal(telegramFromWhatsapp('נכתב ב-whatsapp בלי קישור'), 'נכתב ב-whatsapp בלי קישור')
})

test('Israel date: after midnight in Israel is already the next day', () => {
  assert.equal(israelDate('2026-10-12T21:30:00Z'), '2026-10-13') // 00:30 IDT
  assert.equal(israelDate('2026-10-12T20:59:59Z'), '2026-10-12') // 23:59 IDT
  assert.equal(israelDate('2026-12-31T22:00:00Z'), '2027-01-01') // 00:00 IST
})

test('Israel day bounds: 24 h normally, 23 h / 25 h on the DST switch days', () => {
  const hours = (b: { start: string; end: string }) => (Date.parse(b.end) - Date.parse(b.start)) / 3_600_000
  assert.deepEqual(israelDayBounds('2026-10-13'), { start: '2026-10-12T21:00:00.000Z', end: '2026-10-13T21:00:00.000Z' })
  assert.deepEqual(israelDayBounds('2026-12-01'), { start: '2026-11-30T22:00:00.000Z', end: '2026-12-01T22:00:00.000Z' })
  assert.equal(hours(israelDayBounds('2026-03-27')), 23) // summer time starts (Friday before the last Sunday of March)
  assert.equal(hours(israelDayBounds('2026-10-25')), 25) // summer time ends (last Sunday of October)
  // every instant of a day maps back to that day, both ends
  for (const day of ['2026-03-27', '2026-10-25', '2026-10-13']) {
    const b = israelDayBounds(day)
    assert.equal(israelDate(b.start), day)
    assert.equal(israelDate(Date.parse(b.end) - 1), day)
    assert.equal(israelDate(b.end), israelDateMinus(day, -1))
  }
})

test('streak: consecutive days ending today, or ending yesterday while today has no post yet', () => {
  const today = '2026-10-13'
  assert.equal(postingStreak(['2026-10-13', '2026-10-12', '2026-10-11', '2026-10-09'], today), 3)
  assert.equal(postingStreak(['2026-10-12', '2026-10-11'], today), 2)
  assert.equal(postingStreak(['2026-10-11'], today), 0)
  assert.equal(postingStreak([], today), 0)
  assert.equal(postingStreak(['2026-03-01', '2026-02-28'], '2026-03-01'), 2) // across a month end
})

const row = (article_id: string, platform: string, created_at: string): ApprovedRow =>
  ({ id: `${platform}-${created_at}`, article_id, platform, created_at, posted_url: null })

test('a post marked today fixes the day\'s article; drafts for another article are dropped', () => {
  const r = reconcileDay(
    { linkedin: { article_id: 'A', post_content: 'a' }, twitter: { article_id: 'B', post_content: 'b' } },
    [row('A', 'facebook_il', '2026-10-13T05:00:00Z')],
  )
  assert.equal(r.articleId, 'A')
  assert.deepEqual(Object.keys(r.drafts), ['linkedin'])
  assert.deepEqual(r.dropped, ['twitter'])
})

test('a fresh browser after posting: the article comes from the database, even with no drafts', () => {
  const r = reconcileDay({}, [row('A', 'linkedin', '2026-10-13T05:00:00Z')])
  assert.equal(r.articleId, 'A')
  assert.deepEqual(r.drafts, {})
})

test('nothing posted yet: drafts kept only if they share one article', () => {
  const same = reconcileDay({ linkedin: { article_id: 'A', post_content: 'a' }, whatsapp: { article_id: 'A', post_content: 'w' } }, [])
  assert.equal(same.articleId, 'A')
  assert.equal(Object.keys(same.drafts).length, 2)
  const mixed = reconcileDay({ linkedin: { article_id: 'A', post_content: 'a' }, whatsapp: { article_id: 'B', post_content: 'w' } }, [])
  assert.equal(mixed.articleId, null)
  assert.deepEqual(mixed.drafts, {})
  assert.deepEqual(mixed.dropped.sort(), ['linkedin', 'whatsapp'])
})

test('two articles marked today (a correction): the newest wins', () => {
  const r = reconcileDay({}, [row('A', 'linkedin', '2026-10-13T05:00:00Z'), row('B', 'linkedin', '2026-10-13T06:00:00Z')])
  assert.equal(r.articleId, 'B')
})

test('posted flags count only the day\'s article', () => {
  const rows = [row('A', 'linkedin', '2026-10-13T05:00:00Z'), row('B', 'twitter', '2026-10-13T05:01:00Z')]
  assert.deepEqual([...postedPlatforms(rows, 'A')], ['linkedin'])
  assert.deepEqual([...postedPlatforms(rows, null)], [])
})
