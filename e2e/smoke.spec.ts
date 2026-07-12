import { test, expect } from '@playwright/test'

// ─── 1. Homepage ─────────────────────────────────────────────────────────────
test('homepage: renders at least 3 article cards', async ({ page }) => {
  const res = await page.goto('/')
  expect(res?.status()).toBe(200)
  await expect(page.locator('[data-testid="article-card"]').nth(2)).toBeVisible()
})

// ─── 2. Article page ─────────────────────────────────────────────────────────
test('article page: title and clinical bottom line visible', async ({ page }) => {
  await page.goto('/')
  // Click the first article card link (the h3 inside the card)
  const firstCard = page.locator('[data-testid="article-card"]').first()
  await firstCard.locator('a').first().click()
  await expect(page.locator('[data-testid="article-title"]')).toBeVisible()
  await expect(page.locator('[data-testid="clinical-bottom-line"]')).toBeVisible()
})

// ─── 3. Search ───────────────────────────────────────────────────────────────
test('search: "pyometra" returns at least 1 result', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="search-input"]').fill('pyometra')
  await page.locator('[data-testid="search-submit"]').click()
  await expect(page.locator('[data-testid="article-card"]').first()).toBeVisible()
})

// ─── 4. Save-intent, logged out ──────────────────────────────────────────────
test('save-intent (logged out): auth sheet appears, intent stripped, links are valid', async ({ page, context }) => {
  // Fresh context — no cookies
  await context.clearCookies()

  // Get first article URL from homepage
  await page.goto('/')
  const firstLink = page.locator('[data-testid="article-card"] a').first()
  const href = await firstLink.getAttribute('href')
  expect(href).toBeTruthy()

  // Visit with ?intent=save
  const intentUrl = href!.includes('?')
    ? `${href}&intent=save`
    : `${href}?intent=save`
  await page.goto(intentUrl)

  // Auth sheet must appear
  const sheet = page.locator('[data-testid="save-auth-prompt"]')
  await expect(sheet).toBeVisible()

  // Hebrew headline must be present somewhere in the sheet
  await expect(sheet).toContainText('התחברו')

  // intent=save must be stripped from URL after the handler fires
  await expect(page).not.toHaveURL(/intent=save/)

  // Collect all hrefs from links/buttons inside the sheet
  const linkEls = sheet.locator('a[href]')
  const count = await linkEls.count()
  expect(count).toBeGreaterThan(0)

  const baseURL = page.url().replace(/\/article\/.*/, '')
  for (let i = 0; i < count; i++) {
    const sheetHref = await linkEls.nth(i).getAttribute('href')
    if (!sheetHref) continue
    const fullUrl = sheetHref.startsWith('http') ? sheetHref : `${baseURL}${sheetHref}`

    // Check the page loads (200) and renders an auth form
    const authPage = await context.newPage()
    const authRes = await authPage.goto(fullUrl)
    expect(authRes?.status(), `Expected 200 for ${fullUrl}`).toBe(200)
    // Auth form must exist: email or password input, or a Google button
    const hasForm = await authPage.locator('input[type="email"], input[type="password"], button[data-provider="google"]').count()
    expect(hasForm, `Expected auth form on ${fullUrl}`).toBeGreaterThan(0)
    await authPage.close()
  }
})

// ─── 5. Auth round-trip (desktop only) ───────────────────────────────────────
test('auth round-trip: intent=save saves article, appears in library, unsave removes it', async ({ page, context }) => {
  test.skip(!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD, 'TEST_USER_* not set')

  // Log in via the login page
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL!)
  await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD!)
  await page.locator('button[type="submit"]').click()
  // Wait for redirect away from /login
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 })

  // Pick the first article href from homepage
  await page.goto('/')
  const firstLink = page.locator('[data-testid="article-card"] a').first()
  const href = await firstLink.getAttribute('href')
  expect(href).toBeTruthy()
  const articleId = href!.match(/\/article\/([^/?]+)/)?.[1]
  expect(articleId).toBeTruthy()

  try {
    // Idempotent setup: if already saved, unsave first
    await page.goto(`/article/${articleId}`)
    // Give the bookmark button a moment to reflect saved state
    await page.waitForTimeout(1500)
    const bookmarkBtn = page.locator('[aria-label="Remove from library"], [aria-label="Unsave"]').first()
    if (await bookmarkBtn.isVisible()) {
      await bookmarkBtn.click()
      await page.waitForTimeout(800)
    }

    // Visit with intent=save
    await page.goto(`/article/${articleId}?intent=save`)
    // Toast: "נשמר לספרייה שלך" should appear (or first-save shelf)
    await expect(
      page.locator('text=נשמר').or(page.locator('[data-testid="save-auth-prompt"]').filter({ hasNot: page.locator('x') }))
    ).toBeVisible({ timeout: 8_000 })

    // Verify article is in library
    await page.goto('/library')
    await expect(page.locator(`[href="/article/${articleId}"], [href*="${articleId}"]`).first()).toBeVisible({ timeout: 8_000 })

    // Unsave from the article page
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
    // Cleanup: always leave the article unsaved
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
