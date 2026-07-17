/**
 * generate-route.spec.ts
 *
 * Route-level tests for /api/growth/generate-post article resolution.
 *
 * Spec (item 5): an explicit article_id must be honoured verbatim;
 * a bogus id must error, not improvise; a large-animal article must
 * return 422, not silently substitute another article.
 *
 * GATED: Requires ADMIN_EMAIL + ADMIN_PASSWORD env vars.
 * Skipped automatically in CI (smoke suite) where those are absent.
 *
 * Run manually on a preview or production URL:
 *   SMOKE_BASE_URL=https://preview-xxx.vetree.app \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *   npx playwright test e2e/generate-route.spec.ts --project desktop
 *
 * Note: the "valid id" case makes a real Claude API call (~5-15s, costs tokens).
 * The "bogus id" and "large-animal" cases fail fast with no Claude call.
 */

import { test, expect } from '@playwright/test'

// Fixtures — verified against production DB
const VALID_SMALL_ANIMAL_ID = 'pubmed-42429078'   // Plasma ADAMTS13 in dogs — labels: [Small Animal, Internal Medicine, Pathology]
const MIXED_LARGE_ANIMAL_ID = 'pubmed-42444511'   // UVC keratitis — labels include [Equine, Large Animal] → must 422
const BOGUS_ID              = 'pubmed-BOGUS-00000000'

test.describe('generate-post route: article resolution', () => {
  test.skip(
    !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD,
    'Skipped: ADMIN_EMAIL and ADMIN_PASSWORD must be set to run admin route tests'
  )

  test.beforeEach(async ({ page }) => {
    // Sign in as admin via the UI so session cookies are set correctly
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.ADMIN_EMAIL!)
    await page.locator('input[type="password"]').fill(process.env.ADMIN_PASSWORD!)
    await page.locator('button[type="submit"]').click()
    // Wait for successful login redirect (any non-login page)
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 })
  })

  test('valid article_id is honoured — response echoes the requested id', async ({ page }) => {
    // Real Claude call — allow 60 s
    const response = await page.request.post('/api/growth/generate-post', {
      data: {
        platform: 'twitter',
        language: 'en',
        article_id: VALID_SMALL_ANIMAL_ID,
      },
      timeout: 60_000,
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.post_content).toBeTruthy()
    expect(body.article_id).toBe(VALID_SMALL_ANIMAL_ID)
  })

  test('bogus article_id → 404 error, no substitute article generated', async ({ page }) => {
    const response = await page.request.post('/api/growth/generate-post', {
      data: {
        platform: 'twitter',
        language: 'en',
        article_id: BOGUS_ID,
      },
    })

    expect(response.status()).toBe(404)
    const body = await response.json()
    expect(body.error).toContain('Article not found')
    expect(body.post_content).toBeUndefined()
    expect(body.article_id).toBeUndefined()
  })

  test('mixed large-animal article_id → 422 error, no substitute article generated', async ({ page }) => {
    const response = await page.request.post('/api/growth/generate-post', {
      data: {
        platform: 'twitter',
        language: 'en',
        article_id: MIXED_LARGE_ANIMAL_ID,
      },
    })

    expect(response.status()).toBe(422)
    const body = await response.json()
    expect(body.error).toMatch(/large animal|equine/i)
    expect(body.post_content).toBeUndefined()
    expect(body.article_id).toBeUndefined()
  })
})
