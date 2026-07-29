/**
 * linkedin-metrics-upsert.spec.ts
 *
 * Route-level regression test for the XLSX upload's on-conflict upsert.
 *
 * Bug (fixed in fix/xlsx-upsert-preserves-assignments): re-uploading a post_url
 * that already existed used to overwrite article_id/match_method with this
 * run's (often null) matcher result, silently wiping manual assignments made
 * via the admin picker — ~29 rows lost their assignment on 2026-07-28.
 *
 * This test: seed a row via the real upload route, manually assign it
 * (article_id + match_method='manual') via the real PATCH route, then
 * re-upload the same post_url with new impressions/engagements. Assert the
 * metrics changed and the assignment survived byte-for-byte.
 *
 * GATED: requires ADMIN_EMAIL + ADMIN_PASSWORD + SUPABASE_SERVICE_ROLE_KEY.
 * Skipped automatically in CI (smoke suite) where those are absent — this
 * test writes to and cleans up after itself in the target DB, so it should
 * only be run deliberately against a preview/staging environment.
 *
 * Run manually on a preview URL:
 *   SMOKE_BASE_URL=https://preview-xxx.vetree.app \
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *   npx playwright test e2e/linkedin-metrics-upsert.spec.ts --project desktop
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const TEST_POST_URL = 'https://www.linkedin.com/posts/vetree-test-fixture_do-not-match-anything-activity-9999999999999999-TEST'
const TEST_ARTICLE_ID = 'pubmed-41794045' // any real article id already in the DB — exact article is irrelevant to this test

function buildTopPostsXlsx(impressions: number, engagements: number): Buffer {
  const rows = [
    ['Post URL', 'Post Publish Date', 'Engagements', '', 'Post URL', 'Post Publish Date', 'Impressions'],
    [TEST_POST_URL, '1/15/2025', engagements, '', TEST_POST_URL, '1/15/2025', impressions],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Top Posts')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

test.describe('linkedin-metrics upload: existing-row upsert preserves assignments', () => {
  test.skip(
    !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.SUPABASE_SERVICE_ROLE_KEY,
    'gated on missing ADMIN_EMAIL/ADMIN_PASSWORD/SUPABASE_SERVICE_ROLE_KEY'
  )

  test('re-upload with new metrics: metrics change, manual assignment survives', async ({ page, request }) => {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Sign in directly via supabase-js — the upload/[id] routes require a Bearer
    // access_token, not the cookie session the UI login flow sets.
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({
      email: process.env.ADMIN_EMAIL!,
      password: process.env.ADMIN_PASSWORD!,
    })
    expect(signInError).toBeNull()
    const token = signIn.session!.access_token

    // Clean slate — remove any leftover fixture row from a previous failed run
    await supabaseAdmin.from('linkedin_post_metrics').delete().eq('post_url', TEST_POST_URL)

    try {
      // ── Step 1: seed the row via the real upload route (initial metrics) ──
      const seedXlsx = buildTopPostsXlsx(100, 10)
      const seedResponse = await request.post('/api/admin/linkedin-metrics/upload', {
        headers: { Authorization: `Bearer ${token}` },
        multipart: { file: { name: 'seed.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: seedXlsx } },
      })
      expect(seedResponse.status()).toBe(200)

      const { data: seededRow } = await supabaseAdmin
        .from('linkedin_post_metrics')
        .select('id, impressions, engagements, article_id, match_method')
        .eq('post_url', TEST_POST_URL)
        .single()
      expect(seededRow).toBeTruthy()
      expect(seededRow!.impressions).toBe(100)
      expect(seededRow!.engagements).toBe(10)

      // ── Step 2: manually assign it via the real PATCH route ───────────────
      const patchResponse = await request.patch(`/api/admin/linkedin-metrics/${seededRow!.id}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { article_id: TEST_ARTICLE_ID },
      })
      expect(patchResponse.status()).toBe(200)

      const { data: afterManual } = await supabaseAdmin
        .from('linkedin_post_metrics')
        .select('article_id, match_method')
        .eq('id', seededRow!.id)
        .single()
      expect(afterManual!.article_id).toBe(TEST_ARTICLE_ID)
      expect(afterManual!.match_method).toBe('manual')

      // ── Step 3: re-upload the SAME post_url with NEW metrics ──────────────
      const reuploadXlsx = buildTopPostsXlsx(555, 42)
      const reuploadResponse = await request.post('/api/admin/linkedin-metrics/upload', {
        headers: { Authorization: `Bearer ${token}` },
        multipart: { file: { name: 'reupload.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: reuploadXlsx } },
      })
      expect(reuploadResponse.status()).toBe(200)
      const reuploadBody = await reuploadResponse.json()
      expect(reuploadBody.existing_rows_metric_update_only).toBeGreaterThanOrEqual(1)

      // ── Step 4: metrics changed, assignment survived byte-for-byte ────────
      const { data: finalRow } = await supabaseAdmin
        .from('linkedin_post_metrics')
        .select('impressions, engagements, article_id, match_method')
        .eq('id', seededRow!.id)
        .single()
      expect(finalRow!.impressions).toBe(555)
      expect(finalRow!.engagements).toBe(42)
      expect(finalRow!.article_id).toBe(TEST_ARTICLE_ID)
      expect(finalRow!.match_method).toBe('manual')
    } finally {
      await supabaseAdmin.from('linkedin_post_metrics').delete().eq('post_url', TEST_POST_URL)
    }
  })
})
