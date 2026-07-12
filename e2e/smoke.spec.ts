import { test, expect } from '@playwright/test'

// ─── 1a. Landing page ─────────────────────────────────────────────────────────
// Logged-out visitors hit / and see LandingPage — not the article feed.
// Assert the hero CTAs are present and interactive. Zero CTAs = broken landing.
test('landing page: hero CTAs visible and count >= 2', async ({ page }) => {
  const res = await page.goto('/')
  expect(res?.status()).toBe(200)

  const primaryCta = page.locator('[data-testid="landing-cta-primary"]')
  const browseCta  = page.locator('[data-testid="landing-cta-browse"]')

  await expect(primaryCta).toBeVisible()
  await expect(browseCta).toBeVisible()

  // If this fails, the landing page rendered but CTAs are gone — critical regression.
  const ctaCount = await page.locator('[data-testid^="landing-cta-"]').count()
  expect(ctaCount, 'Expected at least 2 hero CTAs on landing page').toBeGreaterThanOrEqual(2)
})

// ─── 1b. Browse flow ──────────────────────────────────────────────────────────
// Real visitors click "Browse articles" to enter the feed.
// If this CTA is dead or the feed fails to render, that's the bug we're catching.
test('browse flow: clicking Browse articles CTA renders article feed', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="landing-cta-browse"]').click()
  // Feed must render at least 3 cards after the CTA navigation
  await expect(page.locator('[data-testid="article-card"]').nth(2)).toBeVisible()
})

// ─── 2. Article page ─────────────────────────────────────────────────────────
test('article page: title and clinical bottom line visible', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="landing-cta-browse"]').click()
  await page.locator('[data-testid="article-card"]').first().waitFor()
  const firstLink = page.locator('[data-testid="article-card"] a').first()
  await firstLink.click()
  await expect(page.locator('[data-testid="article-title"]')).toBeVisible()
  await expect(page.locator('[data-testid="clinical-bottom-line"]')).toBeVisible()
})

// ─── 3. Search ───────────────────────────────────────────────────────────────
// Search bar lives in the article feed, reached via Browse articles CTA.
test('search: "pyometra" returns at least 1 result', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="landing-cta-browse"]').click()
  await page.locator('[data-testid="article-card"]').first().waitFor()
  await page.locator('[data-testid="search-input"]').fill('pyometra')
  await page.locator('[data-testid="search-submit"]').click()
  await expect(page.locator('[data-testid="article-card"]').first()).toBeVisible()
})

// ─── 4. Save-intent, logged out ──────────────────────────────────────────────
// Source article URL from sitemap.xml — avoids depending on the feed rendering.
test('save-intent (logged out): auth sheet appears, intent stripped, links are valid', async ({ page, context }) => {
  await context.clearCookies()

  // Parse an article path from the sitemap
  await page.goto('/sitemap.xml')
  const xml = await page.content()
  const matches = [...xml.matchAll(/<loc>(https?:\/\/[^/]+\/article\/([^<]+))<\/loc>/g)]
  expect(matches.length, 'Sitemap must contain at least one /article/ URL').toBeGreaterThan(0)
  const articlePath = '/article/' + matches[0][2]

  const intentUrl = `${articlePath}?intent=save`
  await page.goto(intentUrl)

  // Auth sheet must appear
  const sheet = page.locator('[data-testid="save-auth-prompt"]')
  await expect(sheet).toBeVisible()

  // Hebrew headline
  await expect(sheet).toContainText('התחברו')

  // intent=save must be stripped from URL after the handler fires
  await expect(page).not.toHaveURL(/intent=save/)

  // Collect all links inside the sheet and verify each returns 200 with an auth form
  const linkEls = sheet.locator('a[href]')
  const count = await linkEls.count()
  expect(count).toBeGreaterThan(0)

  const origin = new URL(page.url()).origin
  for (let i = 0; i < count; i++) {
    const sheetHref = await linkEls.nth(i).getAttribute('href')
    if (!sheetHref) continue
    const fullUrl = sheetHref.startsWith('http') ? sheetHref : `${origin}${sheetHref}`

    const authPage = await context.newPage()
    const authRes = await authPage.goto(fullUrl)
    expect(authRes?.status(), `Expected 200 for ${fullUrl}`).toBe(200)
    const hasForm = await authPage.locator('input[type="email"], input[type="password"], button[data-provider="google"]').count()
    expect(hasForm, `Expected auth form on ${fullUrl}`).toBeGreaterThan(0)
    await authPage.close()
  }
})

// ─── 5. Auth round-trip (desktop only) ───────────────────────────────────────
test('auth round-trip: intent=save saves article, appears in library, unsave removes it', async ({ page, context }) => {
  test.skip(!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD, 'TEST_USER_* not set')

  await page.goto('/login')
  await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL!)
  await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD!)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 })

  // Logged-in users see the full feed at /
  await page.goto('/')
  const firstLink = page.locator('[data-testid="article-card"] a').first()
  const href = await firstLink.getAttribute('href')
  expect(href).toBeTruthy()
  const articleId = href!.match(/\/article\/([^/?]+)/)?.[1]
  expect(articleId).toBeTruthy()

  try {
    // Idempotent: unsave if already saved from a previous crashed run
    await page.goto(`/article/${articleId}`)
    await page.waitForTimeout(1500)
    const bookmarkBtn = page.locator('[aria-label="Remove from library"], [aria-label="Unsave"]').first()
    if (await bookmarkBtn.isVisible()) {
      await bookmarkBtn.click()
      await page.waitForTimeout(800)
    }

    // Visit with intent=save
    await page.goto(`/article/${articleId}?intent=save`)
    await expect(
      page.locator('text=נשמר').or(page.locator('text=הספרייה'))
    ).toBeVisible({ timeout: 8_000 })

    // Verify in library
    await page.goto('/library')
    await expect(page.locator(`[href="/article/${articleId}"], [href*="${articleId}"]`).first()).toBeVisible({ timeout: 8_000 })

    // Unsave
    await page.goto(`/article/${articleId}`)
    await page.waitForTimeout(1500)
    const unsaveBtn = page.locator('[aria-label="Remove from library"], [aria-label="Unsave"]').first()
    await expect(unsaveBtn).toBeVisible({ timeout: 6_000 })
    await unsaveBtn.click()
    await page.waitForTimeout(800)

    // Verify removed from library
    await page.goto('/library')
    await expect(page.locator(`[href="/article/${articleId}"], [href*="${articleId}"]`).first()).not.toBeVisible({ timeout: 6_000 })

  } finally {
    try {
      await page.goto(`/article/${articleId}`)
      await page.waitForTimeout(1500)
      const cleanup = page.locator('[aria-label="Remove from library"], [aria-label="Unsave"]').first()
      if (await cleanup.isVisible()) await cleanup.click()
    } catch { /* best-effort */ }
  }
})

// ─── 6. Sitemap + robots ─────────────────────────────────────────────────────
test('sitemap and robots.txt: 200 and valid content', async ({ page }) => {
  const sitemapRes = await page.goto('/sitemap.xml')
  expect(sitemapRes?.status()).toBe(200)
  const sitemapBody = await page.content()
  expect(sitemapBody).toContain('vetree.app')

  const robotsRes = await page.goto('/robots.txt')
  expect(robotsRes?.status()).toBe(200)
  const robotsBody = await page.textContent('body')
  expect(robotsBody).toMatch(/user-agent/i)
})
