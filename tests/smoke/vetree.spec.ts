import { test, expect } from '@playwright/test'

// ─── 1. Homepage ──────────────────────────────────────────────────────────────
test('homepage: loads 200, main landmark, skip-nav, no critical console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  const response = await page.goto('/')
  expect(response?.status()).toBe(200)

  await expect(page.locator('main#main-content')).toBeVisible()
  // Skip-nav is visually hidden until focused — just check it's in the DOM
  await expect(page.locator('a[href="#main-content"]')).toBeAttached()
  // Brand name visible (landing page or stream)
  await expect(page.getByText('Vetree').first()).toBeVisible()

  // Filter out harmless errors (fonts, extensions, hydration warnings)
  const critical = consoleErrors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('ERR_BLOCKED') &&
    !e.includes('net::ERR') &&
    !e.includes('hydrat')
  )
  expect(critical, `Unexpected console errors: ${critical.join('; ')}`).toHaveLength(0)
})

// ─── 2. Search happy path ─────────────────────────────────────────────────────
test('search: "canine parvovirus" returns results', async ({ page }) => {
  await page.goto('/?search=canine+parvovirus')
  // Wait for at least one article card link
  await page.waitForSelector('a[href^="/article/"]', { timeout: 20_000 })
  const count = await page.locator('a[href^="/article/"]').count()
  expect(count, 'Expected search results but got zero').toBeGreaterThan(0)
})

// ─── 3. Fuzzy fallback ────────────────────────────────────────────────────────
// NOTE: verify "parvovirs" returns results on production before trusting this test.
// If it legitimately returns zero, use "felin hypertenion" or another misspelling.
test('search fuzzy fallback: misspelled "parvovirs" still returns results', async ({ page }) => {
  await page.goto('/?search=parvovirs')
  await page.waitForSelector('a[href^="/article/"]', { timeout: 20_000 })
  const count = await page.locator('a[href^="/article/"]').count()
  expect(count, 'Fuzzy search returned zero results — check the misspelling or pg_trgm threshold').toBeGreaterThan(0)
})

// ─── 4. Article page ──────────────────────────────────────────────────────────
test('article page: renders title, clinical bottom line, and back-link', async ({ page }) => {
  await page.goto('/?search=canine+parvovirus')
  await page.waitForSelector('a[href^="/article/"]', { timeout: 20_000 })

  const href = await page.locator('a[href^="/article/"]').first().getAttribute('href')
  expect(href).toBeTruthy()

  const response = await page.goto(href!)
  expect(response?.status()).toBe(200)

  // Title (h1 or first large heading)
  await expect(page.locator('h1').first()).toBeVisible()

  // Clinical bottom line section — appears on every enriched article
  await expect(page.getByText(/clinical bottom line/i).first()).toBeVisible()

  // Back link to stream (in ArticleAppBar)
  await expect(page.getByText('Stream').first()).toBeVisible()
})

// ─── 5. Auth pages ────────────────────────────────────────────────────────────
test('signup page: renders email input', async ({ page }) => {
  const response = await page.goto('/signup')
  expect(response?.status()).toBe(200)
  await expect(page.locator('input[type="email"]').first()).toBeVisible()
})

test('login page: renders email input', async ({ page }) => {
  const response = await page.goto('/login')
  expect(response?.status()).toBe(200)
  await expect(page.locator('input[type="email"]').first()).toBeVisible()
})

// ─── 6. API health ────────────────────────────────────────────────────────────
test('API: /api/articles/search-quick returns 200 with articles array', async ({ request }) => {
  const response = await request.get('/api/articles/search-quick?q=canine')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body).toHaveProperty('articles')
  expect(Array.isArray(body.articles)).toBe(true)
})

// ─── 7. Mobile viewport ───────────────────────────────────────────────────────
test('mobile 390px: homepage renders without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  await expect(page.locator('main#main-content')).toBeVisible()

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
  expect(scrollWidth, `Horizontal overflow: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(clientWidth + 2)
})

test('mobile 390px: search results render', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?search=canine+parvovirus')
  await page.waitForSelector('a[href^="/article/"]', { timeout: 20_000 })
  await expect(page.locator('a[href^="/article/"]').first()).toBeVisible()
})

// ─── 8. Sitemap + robots ──────────────────────────────────────────────────────
test('sitemap.xml: returns 200', async ({ request }) => {
  const response = await request.get('/sitemap.xml')
  expect(response.status()).toBe(200)
})

test('robots.txt: returns 200', async ({ request }) => {
  const response = await request.get('/robots.txt')
  expect(response.status()).toBe(200)
})
