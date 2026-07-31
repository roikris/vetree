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
 * Incident (2026-07-31): right after Fix A/B merged, a dry-run reported
 * "Would send: 0, Would skip: 64" for every user. Root cause: the scheduled
 * Friday real send had already fired ~2h earlier on pre-merge code and emailed
 * every currently-eligible subscriber, so the pre-existing "already sent in
 * the last 5 days" dedup correctly (but silently) zeroed the post-merge
 * dry-run — not a bug in Fix A/B. The dry-run response now reports
 * would_skip_reasons + skip_detail so this is diagnosable without a DB trace.
 * The tests below no longer assume TEST_USER_ID is eligible by luck — they
 * force it (consent, opt-out, recent-send dedup) so they can't be fooled by
 * incidental real-world state the way the incident's dry-run was.
 *
 * All tests temporarily mutate real rows (articles, and TEST_USER_ID's
 * followed_tags / user_consents / user_preferences / digest_logs), picked or
 * read at runtime, never hardcoded. Original state is restored in a `finally`
 * block. Uses dry_run:true — no email is sent, no digest_logs / digest_runs /
 * digest_sent_articles rows are written by the route itself.
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

// Forces TEST_USER_ID past every per-user gate the route checks BEFORE article
// selection (opted_out, no_consent, recent_digest) — the three "usual suspects"
// from the 2026-07-31 incident. Without this, a test asserting "recipient is
// selected" is only as reliable as the account's incidental real-world state,
// which is exactly what made that incident's dry-run misleading.
async function ensureFullyEligible(supabaseAdmin: ReturnType<typeof createClient>, userId: string) {
  const { data: existingTrueConsent } = await supabaseAdmin
    .from('user_consents').select('id').eq('user_id', userId).eq('marketing_opted_in', true).limit(1)
  let insertedConsentId: string | null = null
  if (!existingTrueConsent || existingTrueConsent.length === 0) {
    const { data: inserted } = await supabaseAdmin
      .from('user_consents')
      .insert({ user_id: userId, terms_accepted: true, marketing_opted_in: true, consent_version: 'vetree-test-fixture' })
      .select('id')
      .single()
    insertedConsentId = inserted?.id ?? null
  }

  const { data: existingPrefs } = await supabaseAdmin.from('user_preferences').select('*').eq('user_id', userId).maybeSingle()
  await supabaseAdmin.from('user_preferences').upsert({ user_id: userId, digest_opt_out: false }, { onConflict: 'user_id' })

  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentLogs } = await supabaseAdmin.from('digest_logs').select('*').eq('user_id', userId).gte('sent_at', fiveDaysAgo)
  if (recentLogs && recentLogs.length > 0) {
    await supabaseAdmin.from('digest_logs').delete().eq('user_id', userId).gte('sent_at', fiveDaysAgo)
  }

  return { insertedConsentId, existingPrefs: existingPrefs ?? null, recentLogs: recentLogs || [] }
}

async function restoreEligibility(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  original: { insertedConsentId: string | null; existingPrefs: any; recentLogs: any[] }
) {
  if (original.insertedConsentId) {
    await supabaseAdmin.from('user_consents').delete().eq('id', original.insertedConsentId)
  }
  if (original.existingPrefs) {
    await supabaseAdmin.from('user_preferences').upsert(original.existingPrefs, { onConflict: 'user_id' })
  } else {
    await supabaseAdmin.from('user_preferences').delete().eq('user_id', userId)
  }
  if (original.recentLogs.length > 0) {
    await supabaseAdmin.from('digest_logs').insert(original.recentLogs)
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
    const originalEligibility = await ensureFullyEligible(supabaseAdmin, userId)

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
      const skipReason = (body.skip_detail || []).find((s: any) => s.email === process.env.TEST_USER_EMAIL)?.reason
      expect(entry, `TEST_USER_EMAIL must appear in would_send — skip reason: ${skipReason ?? 'not found in skip_detail either'}`).toBeTruthy()

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
      await restoreEligibility(supabaseAdmin, userId, originalEligibility)
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
    const originalEligibility = await ensureFullyEligible(supabaseAdmin, userId)

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
      const skipReason = (body.skip_detail || []).find((s: any) => s.email === process.env.TEST_USER_EMAIL)?.reason
      expect(entry, `TEST_USER_EMAIL must appear in would_send — skip reason: ${skipReason ?? 'not found in skip_detail either'}`).toBeTruthy()
      expect(entry.titles, 'an already-sent article must never be re-selected').not.toContain(SENT_TITLE)
    } finally {
      await supabaseAdmin.from('digest_sent_articles').delete().eq('digest_date', digestDate).eq('article_id', sentFixture.id)
      await supabaseAdmin.from('articles').update({
        title: sentFixture.title, clinical_bottom_line: sentFixture.clinical_bottom_line,
        labels: sentFixture.labels, publication_date: sentFixture.publication_date, created_at: sentFixture.created_at,
      }).eq('id', sentFixture.id)
      await restoreFollowedTags(supabaseAdmin, userId, originalTags)
      await restoreEligibility(supabaseAdmin, userId, originalEligibility)
    }
  })

  // Regression guard for the 2026-07-31 incident: a fully-eligible recipient
  // (consented, not opted out, no recent send) with a matching fresh article
  // must always be selected. This is the invariant that "Would send: 0" broke
  // an appearance of, without any of the selection logic actually being wrong.
  test('a fully-eligible recipient is selected when a fresh matching article exists', async ({ request }) => {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const userId = process.env.TEST_USER_ID!
    const ts = Date.now()
    const FRESH_TITLE = `VETREE-TEST-FIXTURE-ELIGIBLE-${ts}`

    const [freshFixture] = await pickEligibleArticleIds(supabaseAdmin, 1)
    const originalTags = await swapFollowedTags(supabaseAdmin, userId, 'Radiology')
    const originalEligibility = await ensureFullyEligible(supabaseAdmin, userId)

    try {
      await supabaseAdmin.from('articles').update({
        title: FRESH_TITLE,
        clinical_bottom_line: 'VETREE-TEST-FIXTURE',
        labels: ['Radiology'],
        publication_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      }).eq('id', freshFixture.id)

      const response = await request.post('/api/digest/send', {
        headers: { Authorization: `Bearer ${process.env.DIGEST_SECRET}` },
        data: { dry_run: true },
        timeout: 60_000,
      })
      expect(response.status()).toBe(200)
      const body = await response.json()

      expect(body.would_send.length, `dry-run must select >0 recipients when a fully-eligible user has a fresh matching article — got would_skip_reasons: ${JSON.stringify(body.would_skip_reasons)}`).toBeGreaterThan(0)

      const entry = (body.would_send || []).find((u: any) => u.email === process.env.TEST_USER_EMAIL)
      const skipReason = (body.skip_detail || []).find((s: any) => s.email === process.env.TEST_USER_EMAIL)?.reason
      expect(entry, `TEST_USER_EMAIL must appear in would_send — skip reason: ${skipReason ?? 'not found in skip_detail either'}`).toBeTruthy()
      expect(entry.article_count).toBeGreaterThan(0)
      expect(entry.titles).toContain(FRESH_TITLE)
    } finally {
      await supabaseAdmin.from('articles').update({
        title: freshFixture.title, clinical_bottom_line: freshFixture.clinical_bottom_line,
        labels: freshFixture.labels, publication_date: freshFixture.publication_date, created_at: freshFixture.created_at,
      }).eq('id', freshFixture.id)
      await restoreFollowedTags(supabaseAdmin, userId, originalTags)
      await restoreEligibility(supabaseAdmin, userId, originalEligibility)
    }
  })
})
