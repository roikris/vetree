// growth-005: the December trial's rules (lib/growth/trial.ts), its prompts (lib/growth/trialPrompts.ts) and the
// variant table copied into migration 089's trial_variant().
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  TRIAL_SCHEDULE, TRIAL_START, TRIAL_END, TRIAL_DAYS, assignmentFor, inTrial, trialPhase, trialDayNumber, whatsappDay,
  trialPlatformsFor, variantFor, trialCampaign, parseTrialCampaign, hasTakePlaceholder, textFeatures, TAKE_MARKER,
} from '../../lib/growth/trial'
import { linkedinTrialPrompt, whatsappShortPrompt, avoidOpenings, linkedinFirstComment } from '../../lib/growth/trialPrompts'
import { telegramFromWhatsapp } from '../../lib/growth/daily'

const dates = Object.keys(TRIAL_SCHEDULE)

test('the schedule covers every December day once, WhatsApp variants exactly on WhatsApp days', () => {
  assert.equal(dates.length, TRIAL_DAYS)
  assert.equal(dates[0], TRIAL_START)
  assert.equal(dates.at(-1), TRIAL_END)
  for (const d of dates) assert.equal(!!TRIAL_SCHEDULE[d].whatsapp, whatsappDay(d), d)
})

test('arms are balanced overall and within each Israel week', () => {
  const count = (vals: string[], v: string) => vals.filter(x => x === v).length
  const li = dates.map(d => TRIAL_SCHEDULE[d].linkedin)
  const wa = dates.map(d => TRIAL_SCHEDULE[d].whatsapp).filter(Boolean) as string[]
  assert.ok(Math.abs(count(li, 'in_post') - count(li, 'first_comment')) <= 1)
  assert.equal(count(wa, 'short'), count(wa, 'current'))
  const weeks = new Map<string, string[]>()
  for (const d of dates) {
    const day = new Date(`${d}T00:00:00Z`)
    const sunday = new Date(day.getTime() - day.getUTCDay() * 86400000).toISOString().slice(0, 10)
    weeks.set(sunday, [...(weeks.get(sunday) ?? []), TRIAL_SCHEDULE[d].linkedin])
  }
  for (const [w, vals] of weeks) assert.ok(Math.abs(count(vals, 'in_post') - count(vals, 'first_comment')) <= 1, w)
})

test("migration 089's trial_variant() holds the same table", () => {
  const sql = readFileSync('supabase/migrations/089_growth_trial_posts.sql', 'utf8')
  const rows = [...sql.matchAll(/\(DATE '(\d{4}-\d{2}-\d{2})', '(\w+)', (NULL|'\w+')\)/g)]
  assert.equal(rows.length, TRIAL_DAYS)
  for (const [, d, li, wa] of rows) {
    assert.equal(li, TRIAL_SCHEDULE[d].linkedin, d)
    assert.equal(wa === 'NULL' ? undefined : wa.replaceAll("'", ''), TRIAL_SCHEDULE[d].whatsapp, d)
  }
})

test('window, phase and day number use Israel dates', () => {
  assert.equal(inTrial('2026-11-30'), false)
  assert.equal(inTrial('2026-12-01'), true)
  assert.equal(inTrial('2027-01-01'), false)
  assert.equal(trialPhase(new Date('2026-11-30T21:59:00Z')), 'before') // 23:59 Israel
  assert.equal(trialPhase(new Date('2026-11-30T22:00:00Z')), 'running') // 00:00 Israel, Dec 1
  assert.equal(trialPhase(new Date('2026-12-31T22:00:00Z')), 'ended')
  assert.equal(trialDayNumber('2026-12-17'), 17)
  assert.equal(trialDayNumber('2026-11-17'), null)
})

test('preview before December uses Dec 1; none after the trial', () => {
  assert.deepEqual(assignmentFor('2026-11-25', { preview: true }), TRIAL_SCHEDULE[TRIAL_START])
  assert.equal(assignmentFor('2026-11-25'), null)
  assert.equal(assignmentFor('2027-01-02', { preview: true }), null)
})

test('WhatsApp + Telegram only on Sun / Mon / Tue / Thu; never X', () => {
  assert.equal(whatsappDay('2026-12-06'), true) // Sunday
  assert.equal(whatsappDay('2026-12-09'), false) // Wednesday
  assert.equal(whatsappDay('2026-12-12'), false) // Saturday
  const wed = trialPlatformsFor('2026-12-09').map(p => p.platform)
  assert.deepEqual(wed, ['facebook_il', 'linkedin', 'facebook_intl'])
  const sun = trialPlatformsFor('2026-12-06').map(p => p.platform)
  assert.deepEqual(sun, ['facebook_il', 'whatsapp', 'telegram', 'linkedin', 'facebook_intl'])
  assert.ok(!sun.includes('twitter'))
})

test('variants: LinkedIn and the WhatsApp pair; Facebook none', () => {
  const a = TRIAL_SCHEDULE['2026-12-07']
  assert.equal(variantFor('linkedin', a), 'first_comment')
  assert.equal(variantFor('whatsapp', a), 'short')
  assert.equal(variantFor('telegram', a), 'short')
  assert.equal(variantFor('facebook_il', a), null)
  assert.equal(variantFor('linkedin', null), null)
})

test('tracking tokens: one per post, Facebook Intl keeps its prefix, Telegram inherits WhatsApp\'s via the swap', () => {
  assert.equal(trialCampaign('linkedin', '2026-12-03'), 'trial-20261203')
  assert.equal(trialCampaign('facebook_intl', '2026-12-03'), 'intl-trial-20261203')
  assert.equal(trialCampaign('facebook_il', '2026-12-03'), null)
  assert.deepEqual(parseTrialCampaign('intl-trial-20261203'), { intl: true, date: '2026-12-03' })
  assert.deepEqual(parseTrialCampaign('trial-20261231'), { intl: false, date: '2026-12-31' })
  assert.equal(parseTrialCampaign('trial-20261130'), null)
  assert.equal(parseTrialCampaign('il'), null)
  const wa = 'x https://vetree.app/article/a?utm_source=whatsapp&utm_medium=social&utm_campaign=trial-20261203'
  assert.match(telegramFromWhatsapp(wa), /utm_source=telegram&utm_medium=social&utm_campaign=trial-20261203/)
})

test('take placeholder and text features', () => {
  assert.equal(hasTakePlaceholder(`a\n${TAKE_MARKER} — edit: I'd do X]\nb?`), true)
  assert.equal(hasTakePlaceholder('In my practice I do X.'), false)
  assert.deepEqual(textFeatures('Hook\n\nBody line.\nWhat do you use for cats?\n\n🔗 https://vetree.app/article/x'), { char_count: [...'Hook\n\nBody line.\nWhat do you use for cats?\n\n🔗 https://vetree.app/article/x'].length, ends_with_question: true })
  assert.equal(textFeatures('Body.\n📄 Title?').ends_with_question, false)
})

test('prompts: LinkedIn link rule per variant, the take line, the repetition guard', () => {
  const art = { title: 'T', clinical_bottom_line: 'B', labels: ['Feline'] }
  const inPost = linkedinTrialPrompt(art, { variant: 'in_post', articleUrl: 'https://vetree.app/article/x?u=1', recentHooks: ['A dog comes in limping'] })
  assert.match(inPost, /🔗 https:\/\/vetree\.app\/article\/x\?u=1/)
  assert.ok(inPost.includes(TAKE_MARKER))
  assert.match(inPost, /A dog comes in limping/)
  const comment = linkedinTrialPrompt(art, { variant: 'first_comment', articleUrl: 'https://vetree.app/article/x', recentHooks: [] })
  assert.doesNotMatch(comment, /vetree\.app\/article/)
  assert.match(comment, /NO link/)
  assert.equal(avoidOpenings([]), '')
  assert.match(whatsappShortPrompt(art, { articleUrl: 'https://vetree.app/article/x', recentHooks: [] }), /60–100 words/)
  assert.equal(linkedinFirstComment('T', 'https://u'), '📄 T\n🔗 https://u')
})
