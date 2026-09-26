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
  // Feed must render at least 3 cards after the CTA navigation (15s for cold starts)
  await expect(page.locator('[data-testid="article-card"]').nth(2)).toBeVisible({ timeout: 15_000 })
})

// ─── 2. Article page ─────────────────────────────────────────────────────────
test('article page: title and clinical bottom line visible', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="landing-cta-browse"]').click()
  await page.locator('[data-testid="article-card"]').first().waitFor({ timeout: 15_000 })
  const firstLink = page.locator('[data-testid="article-card"] a').first()
  await firstLink.click()
  await expect(page.locator('[data-testid="article-title"]')).toBeVisible()
  await expect(page.locator('[data-testid="clinical-bottom-line"]')).toBeVisible()
})

// ─── 3. Search ───────────────────────────────────────────────────────────────
// Real search: click the search icon to open the input, type, press Enter.
// The input is in SearchControls and is gated behind the toggle button.
test('search: "pyometra" returns at least 1 result', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="landing-cta-browse"]').click()
  await page.locator('[data-testid="article-card"]').first().waitFor({ timeout: 15_000 })
  await page.locator('[data-testid="search-toggle"]').click()
  await page.locator('[data-testid="search-input"]').fill('pyometra')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-testid="article-card"]').first()).toBeVisible({ timeout: 15_000 })
})

// Search is species-scoped with small animal as the default, but large-animal research
// (~7,800 enriched articles) must stay reachable. "bovine mastitis" is the canonical case:
// it has no small-animal matches, so the default search is empty — and that empty state
// must offer the widened search rather than read as "no coverage".
test('search: large-animal term is reachable from the default scope via "search all species"', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="landing-cta-browse"]').click()
  await page.locator('[data-testid="article-card"]').first().waitFor({ timeout: 15_000 })
  await page.locator('[data-testid="search-toggle"]').click()
  await page.locator('[data-testid="search-input"]').fill('bovine mastitis')
  await page.keyboard.press('Enter')
  const widen = page.locator('[data-testid="zero-results-all-species"]')
  await expect(widen).toBeVisible({ timeout: 15_000 })
  await widen.click()
  await expect(page).toHaveURL(/quickFilter=all/)
  await expect(page.locator('[data-testid="article-card"]').first()).toBeVisible({ timeout: 15_000 })
})

// The species control must be reachable and drive the URL. A previous version of this
// feature relied on a component that was never mounted, so no user could change scope.
test('species control: default is small animal, and switching scope updates the URL', async ({ page }) => {
  await page.goto('/?browse=1')
  await page.locator('[data-testid="article-card"]').first().waitFor({ timeout: 15_000 })
  await expect(page.locator('[data-testid="species-small-animal"]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-testid="species-large-animal"]').click()
  await expect(page).toHaveURL(/quickFilter=large-animal/)
  await expect(page.locator('[data-testid="species-large-animal"]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-testid="species-small-animal"]').click()
  // the default is omitted from the URL...
  await expect(page).not.toHaveURL(/quickFilter=/)
  // ...but the visitor must stay in the feed. An earlier version produced a bare `/?`,
  // which a logged-out visitor sees as the landing page — the control and feed vanished.
  await expect(page.locator('[data-testid="species-small-animal"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-testid="article-card"]').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-testid="landing-cta-browse"]')).toHaveCount(0)
})

// ─── Mobile header: open search fits the screen, pinch-zoom not blocked ───────
test('mobile header: open search causes no horizontal scroll and zoom is allowed', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone-width layout check')
  await page.goto('/?search=pyometra&browse=1')
  const input = page.locator('[data-testid="search-input"]')
  await expect(input).toBeVisible()

  const m = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    inputW: document.querySelector('[data-testid="search-input"]')!.getBoundingClientRect().width,
    fontSize: parseFloat(getComputedStyle(document.querySelector('[data-testid="search-input"]')!).fontSize),
    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
  }))
  expect(m.scrollW, 'page must not scroll sideways with search open').toBeLessThanOrEqual(m.innerW)
  expect(m.inputW, 'search input must have usable width').toBeGreaterThanOrEqual(100)
  // < 16px makes iOS zoom on focus; the fix is 16px fields, never re-blocking zoom
  expect(m.fontSize).toBeGreaterThanOrEqual(16)
  expect(m.viewport).not.toMatch(/maximum-scale|user-scalable=no/i)
  // The wordmark is hidden while searching on phones; the home link must keep a name
  await expect(page.getByRole('link', { name: 'Vetree home' })).toBeVisible()
})

// /sitemap.xml is a sitemap index (app/sitemap.xml/route.ts); articles are in shards.
// Follow the index to shard 0 by PATH — its <loc> is absolute https://vetree.app, which
// would test production instead of the preview under test.
async function firstSitemapShard(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/sitemap.xml')
  const index = await page.content()
  const shard = index.match(/<loc>https?:\/\/[^/]+(\/sitemaps\/sitemap\/\d+\.xml)<\/loc>/)
  expect(shard, 'Sitemap index must list at least one article shard').not.toBeNull()
  await page.goto(shard![1])
  return page.content()
}

// ─── Original abstract: collapsed, loaded on open, attributed ────────────────
test('article page: original abstract loads on open with PubMed attribution', async ({ page, request }) => {
  const xml = await firstSitemapShard(page)
  const ids = [...xml.matchAll(/<loc>https?:\/\/[^/]+\/article\/([^<]+)<\/loc>/g)].slice(0, 15).map(m => m[1])
  // Most articles have an abstract; a few kept-for-reference ones don't — pick one that does
  const probes = await Promise.all(ids.map(async (candidate) => {
    const res = await request.get(`/api/articles/${candidate}/abstract`)
    return res.ok() && (await res.json()).abstract ? candidate : null
  }))
  const id = probes.find(Boolean) ?? null
  expect(id, 'one of the first sitemap articles must have a stored abstract').not.toBeNull()
  const { abstract } = await (await request.get(`/api/articles/${id}/abstract`)).json()

  // Loaded on open only: no abstract request may happen before the toggle is clicked
  let requestedEarly = false
  page.on('request', (r) => { if (r.url().includes('/abstract')) requestedEarly = true })
  await page.goto(`/article/${id}`)
  // Not networkidle: Vercel previews keep connections open (toolbar, analytics), so it never settles
  const toggle = page.locator('[data-testid="original-abstract-toggle"]')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(requestedEarly, 'abstract must not load until opened').toBe(false)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const attribution = page.locator('[data-testid="original-abstract-attribution"]')
  await expect(attribution).toContainText('© the publisher')
  await expect(attribution).toContainText('PubMed')
  await expect(page.locator('[data-testid="original-abstract-panel"]')).toContainText(abstract.split('\n\n')[0].slice(-40).trim())
})

// ─── 4. Save-intent, logged out ──────────────────────────────────────────────
// Source article URL from the sitemap — avoids depending on the feed rendering.
test('save-intent (logged out): auth sheet appears, intent stripped, links are valid', async ({ page, context }) => {
  await context.clearCookies()

  // Parse an article path from the sitemap: /sitemap.xml is an index, articles live in shards
  const xml = await firstSitemapShard(page)
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
test('auth round-trip: intent=save saves article, appears in library, unsave removes it', async ({ page, context }, testInfo) => {
  test.skip(!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD, 'gated on missing TEST_USER_EMAIL/TEST_USER_PASSWORD')
  test.skip(testInfo.project.name !== 'desktop', 'mobile-scoped (by design — avoid shared-account interference)')

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
    // Idempotent: unsave if already saved from a previous crashed run.
    // Wait for the button to reflect "Save to library" (confirms the API call completed)
    // before navigating away — avoids a race where SaveIntentHandler still sees it as saved.
    await page.goto(`/article/${articleId}`)
    const bookmarkBtn = page.locator('[aria-label="Remove from library"], [aria-label="Unsave"]').first()
    if (await bookmarkBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await bookmarkBtn.click()
      await page.locator('[aria-label="Save to library"]').first().waitFor({ timeout: 6_000 })
    }

    // Visit with intent=save
    await page.goto(`/article/${articleId}?intent=save`)
    // SaveIntentHandler shows a toast (save-toast) or first-save shelf (first-save-shelf)
    await expect(
      page.locator('[data-testid="save-toast"]')
        .or(page.locator('[data-testid="already-saved-toast"]'))
        .or(page.locator('[data-testid="first-save-shelf"]'))
    ).toBeVisible({ timeout: 15_000 })

    // Verify in library
    await page.goto('/library')
    await expect(page.locator(`[href="/article/${articleId}"], [href*="${articleId}"]`).first()).toBeVisible({ timeout: 8_000 })

    // Unsave — wait for API commit, not just optimistic UI, before navigating
    await page.goto(`/article/${articleId}`)
    const unsaveBtn = page.locator('[aria-label="Remove from library"], [aria-label="Unsave"]').first()
    await expect(unsaveBtn).toBeVisible({ timeout: 6_000 })
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/save-article') && r.ok()),
      unsaveBtn.click(),
    ])

    // Verify removed from library
    await page.goto('/library')
    await expect(page.locator(`[href="/article/${articleId}"], [href*="${articleId}"]`).first()).not.toBeVisible({ timeout: 6_000 })

  } finally {
    try {
      await page.goto(`/article/${articleId}`)
      const cleanup = page.locator('[aria-label="Remove from library"], [aria-label="Unsave"]').first()
      if (await cleanup.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await Promise.all([
          page.waitForResponse(r => r.url().includes('/api/save-article') && r.ok()),
          cleanup.click(),
        ])
      }
    } catch { /* best-effort */ }
  }
})

// ─── 5b. Post-login redirect: no race, no manual refresh ────────────────────
// Real bug: after signInWithPassword, the redirect could fire before the
// session was actually persisted/readable server-side — landing the user
// back on /login instead of their destination (fixed in app/login/page.tsx,
// lib/hooks/useAuth.ts, app/auth/callback/route.ts). return=/profile
// exercises a genuine hard-redirect guard (app/profile/page.tsx's
// redirect('/login') on a null server-side user) — the literal mechanism
// Roi hit, not just a soft "wrong content flashed" symptom. Deliberately does
// NOT call page.goto() again after clicking submit — that would be exactly
// the "everyone just refreshes" workaround this test exists to make
// impossible to hide behind. Runs on both desktop and mobile (read-only, no
// shared-account interference risk unlike the save/unsave test above).
test('post-login redirect: lands on the protected destination immediately, no refresh', async ({ page }) => {
  test.skip(!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD, 'gated on missing TEST_USER_EMAIL/TEST_USER_PASSWORD')

  await page.goto('/login?return=%2Fprofile')
  await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL!)
  await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD!)
  await page.locator('button[type="submit"]').click()

  // No page.goto() here. The login flow's own navigation must land us on
  // /profile directly — if it bounces to /login first, this fails.
  await page.waitForURL(url => url.pathname === '/profile', { timeout: 15_000 })
  await expect(page).toHaveURL(/\/profile$/)

  // Confirm it's genuinely the authenticated profile page, not a login form
  // that happens to share a URL prefix.
  await expect(page.getByText('Email Preferences')).toBeVisible({ timeout: 10_000 })
})

// ─── 5c. Protected routes redirect anonymous visitors ───────────────────────
// The guarantee perf/middleware-cost (PR #40) promises not to weaken: /profile,
// /library, and /admin each hard-redirect(' /login') a null server-side user
// (app/profile/page.tsx, app/library/page.tsx, app/admin/layout.tsx). This is
// the regression test for both that guard and the middleware matcher/cookie-
// presence check still letting these requests reach it.
for (const path of ['/profile', '/library', '/admin']) {
  test(`protected route ${path}: anonymous visitor is redirected to /login`, async ({ page, context }) => {
    await context.clearCookies()
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
  })
}

// ─── 6. Sitemap + robots ─────────────────────────────────────────────────────
test('sitemap and robots.txt: 200 and valid content', async ({ page }) => {
  const sitemapRes = await page.goto('/sitemap.xml')
  expect(sitemapRes?.status()).toBe(200)
  const sitemapBody = await page.content()
  expect(sitemapBody).toContain('<sitemapindex')
  expect(sitemapBody).toContain('/sitemaps/static.xml')
  const shardBody = await firstSitemapShard(page)
  expect(shardBody, 'First sitemap shard must list article URLs').toMatch(/<loc>https?:\/\/[^/]+\/article\//)

  const robotsRes = await page.goto('/robots.txt')
  expect(robotsRes?.status()).toBe(200)
  const robotsBody = await page.textContent('body')
  expect(robotsBody).toMatch(/user-agent/i)
})
