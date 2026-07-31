/**
 * digest-recency-and-memory.spec.ts
 *
 * Route-level regression tests for /api/digest/send article selection.
 *
 * Bug: article selection ranked candidates by publication_date DESC. Preprints
 * can carry a publication_date months in the future, which permanently pinned
 * them at the top of the sort — the same handful of articles kept repeating
 * in the weekly digest indefinitely.
 *
 * Fix A: selection now ranks by created_at (when Vetree ingested the article).
 * publication_date is display metadata only.
 * Fix B: a new digest_sent_articles table records every article ever included
 * in a digest send; selection excludes anything ever sent, globally.
 *
 * Both tests temporarily mutate two REAL article rows (picked at runtime, not
 * hardcoded) plus TEST_USER_ID's followed_tags, to build a deterministic
 * fixture inside a normally-changing table. Original state is restored in a
 * `finally` block. Uses dry_run:true — no email is sent, no digest_logs /
 * digest_runs / digest_sent_articles rows are written by the route itself.
 *
 * GATED: requires DIGEST_SECRET + SUPABASE_SERVICE_ROLE_KEY + TEST_USER_ID +
 * TEST_USER_EMAIL. Skipped automatically in CI (smoke suite) where those are
 * absent — this test writes to and restores state in the target DB, so it
 * should only be run deliberately against a preview/staging environment.
 *
 * Run manually on a preview URL:
 *   SMOKE_BASE_URL=https://preview-xxx.vetree.app \
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DIGEST_SECRET=... \
 *   TEST_USER_ID=... TEST_USER_EMAIL=... \
 *   npx playwright test e2e/digest-recency-and-memory.spec.ts --project desktop
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const GATE_MISSING =
  !process.env.DIGEST_SECRET ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY ||
  !process.env.TEST_USER_ID ||
  !process.env.TEST_USER_EMAIL

const ARTICLE_FIELDS = 'id, title, clinical_bottom_line, labels, publication_date, created_at, quarantined, needs_enrichment'

async function pickEligibleArticleIds(supabaseAdmin: ReturnType<typeof createClient>, count: number) {
  const { data, error } = await supabaseAdmin
    .from('articles')
    .select(ARTICLE_FIELDS)
    .eq('needs_enrichment', false)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')
    .order('id', { ascending: true })
    .limit(count)
  expect(error, 'must find eligible articles to use as scratch fixtures').toBeNull()
  expect(data?.length, 'need at least ' + count + ' public-eligible articles in the DB to run this test').toBeGreaterThanOrEqual(count)
  return data!
}

async function swapFollowedTags(supabaseAdmin: ReturnType<typeof createClient>, userId: string, tag: string) {
  const { data: original } = await supabaseAdmin.from('followed_tags').select('user_id, tag').eq('user_id', userId)
  await supabaseAdmin.from('followed_tags').delete().eq('user_id', userId)
  await supabaseAdmin.from('followed_tags').insert({ user_id: userId, tag })
  return original || []
}

async function restoreFollowedTags(supabaseAdmin: ReturnType<typeof createClient>, userId: string, original: { user_id: string; tag: string }[]) {
  await supabaseAdmin.from('followed_tags').delete().eq('user_id', userId)
  if (original.length > 0) {
    await supabaseAdmin.from('followed_tags').insert(original)
  }
}

test.describe('digest send: recency clock and never-resend memory', () => {
  test.skip(GATE_MISSING, 'gated on missing DIGEST_SECRET/SUPABASE_SERVICE_ROLE_KEY/TEST_USER_ID/TEST_USER_EMAIL')

  test('a future-dated article does not outrank a just-ingested one', async ({ request }) => {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const userId = process.env.TEST_USER_ID!
    const ts = Date.now()
    const FUTURE_TITLE = `VETREE-TEST-FIXTURE-FUTURE-${ts}`
    const JUST_TITLE = `VETREE-TEST-FIXTURE-JUST-${ts}`

    const [futureFixture, justFixture] = await pickEligibleArticleIds(supabaseAdmin, 2)
    const originalTags = await swapFollowedTags(supabaseAdmin, userId, 'Dentistry')

    try {
      // Future-dated but ingested 2 days ago — must NOT outrank content ingested just now
      await supabaseAdmin.from('articles').update({
        title: FUTURE_TITLE,
        clinical_bottom_line: 'VETREE-TEST-FIXTURE',
        labels: ['Dentistry'],
        publication_date: '2099-01-01',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', futureFixture.id)

      await supabaseAdmin.from('articles').update({
        title: JUST_TITLE,
        clinical_bottom_line: 'VETREE-TEST-FIXTURE',
        labels: ['Dentistry'],
        publication_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      }).eq('id', justFixture.id)

      const response = await request.post('/api/digest/send', {
        headers: { Authorization: `Bearer ${process.env.DIGEST_SECRET}` },
        data: { dry_run: true },
        timeout: 60_000,
      })
      expect(response.status()).toBe(200)
      const body = await response.json()

      const entry = (body.would_send || []).find((u: any) => u.email === process.env.TEST_USER_EMAIL)
      expect(entry, 'TEST_USER_EMAIL must appear in would_send — check its opt-out/marketing-consent/recent-digest state').toBeTruthy()

      const justIndex = entry.titles.indexOf(JUST_TITLE)
      const futureIndex = entry.titles.indexOf(FUTURE_TITLE)
      expect(justIndex, 'the just-ingested fixture must be selected').toBeGreaterThanOrEqual(0)
      if (futureIndex >= 0) {
        expect(justIndex, 'just-ingested article must rank ahead of the future-dated one').toBeLessThan(futureIndex)
      }
    } finally {
      await supabaseAdmin.from('articles').update({
        title: futureFixture.title, clinical_bottom_line: futureFixture.clinical_bottom_line,
        labels: futureFixture.labels, publication_date: futureFixture.publication_date, created_at: futureFixture.created_at,
      }).eq('id', futureFixture.id)
      await supabaseAdmin.from('articles').update({
        title: justFixture.title, clinical_bottom_line: justFixture.clinical_bottom_line,
        labels: justFixture.labels, publication_date: justFixture.publication_date, created_at: justFixture.created_at,
      }).eq('id', justFixture.id)
      await restoreFollowedTags(supabaseAdmin, userId, originalTags)
    }
  })

  test('an article already in digest_sent_articles is never selected again', async ({ request }) => {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const userId = process.env.TEST_USER_ID!
    const ts = Date.now()
    const SENT_TITLE = `VETREE-TEST-FIXTURE-SENT-${ts}`
    const digestDate = new Date().toISOString().split('T')[0]

    const [sentFixture] = await pickEligibleArticleIds(supabaseAdmin, 1)
    const originalTags = await swapFollowedTags(supabaseAdmin, userId, 'Behavior')

    try {
      await supabaseAdmin.from('articles').update({
        title: SENT_TITLE,
        clinical_bottom_line: 'VETREE-TEST-FIXTURE',
        labels: ['Behavior'],
        publication_date: digestDate,
        created_at: new Date().toISOString(),
      }).eq('id', sentFixture.id)

      await supabaseAdmin.from('digest_sent_articles').insert({ digest_date: digestDate, article_id: sentFixture.id })

      const response = await request.post('/api/digest/send', {
        headers: { Authorization: `Bearer ${process.env.DIGEST_SECRET}` },
        data: { dry_run: true },
        timeout: 60_000,
      })
      expect(response.status()).toBe(200)
      const body = await response.json()

      const entry = (body.would_send || []).find((u: any) => u.email === process.env.TEST_USER_EMAIL)
      expect(entry, 'TEST_USER_EMAIL must appear in would_send — check its opt-out/marketing-consent/recent-digest state').toBeTruthy()
      expect(entry.titles, 'an already-sent article must never be re-selected').not.toContain(SENT_TITLE)
    } finally {
      await supabaseAdmin.from('digest_sent_articles').delete().eq('digest_date', digestDate).eq('article_id', sentFixture.id)
      await supabaseAdmin.from('articles').update({
        title: sentFixture.title, clinical_bottom_line: sentFixture.clinical_bottom_line,
        labels: sentFixture.labels, publication_date: sentFixture.publication_date, created_at: sentFixture.created_at,
      }).eq('id', sentFixture.id)
      await restoreFollowedTags(supabaseAdmin, userId, originalTags)
    }
  })
})
