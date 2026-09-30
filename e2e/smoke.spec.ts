import { test, expect } from '@playwright/test'
import { clearCookiesKeepPreviewAccess } from './preview-access'

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

// A search starts unfiltered (all species) and the reader narrows it with the filter bar.
// "bovine mastitis" is the canonical case: large-animal research, so the default search
// finds it directly; narrowing to small animal empties the results, and that empty state
// must offer the widened search rather than read as "no coverage".
test('search: starts across all species, and narrowing can be undone from the empty state', async ({ page }) => {
  await page.goto('/?browse=1')
  await page.locator('[data-testid="article-card"]').first().waitFor({ timeout: 15_000 })
  // A filter chosen before searching must not carry into the search
  await page.locator('[data-testid="species-large-animal"]').click()
  await expect(page).toHaveURL(/quickFilter=large-animal/)
  await page.locator('[data-testid="search-toggle"]').click()
  await page.locator('[data-testid="search-input"]').fill('bovine mastitis')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/search=bovine/)
  await expect(page).not.toHaveURL(/quickFilter=/)
  await expect(page.locator('[data-testid="species-all"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-testid="article-card"]').first()).toBeVisible({ timeout: 15_000 })

  // Narrow to small animal: nothing, and the empty state offers all species again
  await page.locator('[data-testid="species-small-animal"]').click()
  await expect(page).toHaveURL(/quickFilter=small-animal/)
  const widen = page.locator('[data-testid="zero-results-all-species"]')
  await expect(widen).toBeVisible({ timeout: 15_000 })
  await widen.click()
  await expect(page.locator('[data-testid="species-all"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-testid="article-card"]').first()).toBeVisible({ timeout: 15_000 })
})

// ─── Progressive search: Best match default, toggle, reveal, finish ───────────────
test('search: opens in Best match and ends with "Search finished!"', { tag: '@desktop-only' }, async ({ page }) => {
  await page.goto('/?search=pyometra')
  await expect(page.locator('[data-testid="sort-relevance"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 })
  await expect(page.locator('#main-feed')).toContainText(/\d+ results for/)
  const progress = page.locator('[data-testid="search-progress"]')
  await progress.scrollIntoViewIfNeeded()
  await expect(progress).toContainText('Search finished!', { timeout: 15_000 })
})

test('search: Newest toggle updates the URL and reveals more on scroll', async ({ page }) => {
  await page.goto('/?search=dog')
  await expect(page.locator('[data-testid="sort-relevance"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 })
  await page.locator('[data-testid="sort-newest"]').click()
  await expect(page).toHaveURL(/sort=newest/)
  await expect(page.locator('[data-testid="sort-newest"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 })
  const rows = page.locator('#main-feed a[href^="/article/"]')
  const before = await rows.count()
  // Keyboard/a11y path and scroll path both advance the list
  await page.locator('[data-testid="search-load-more"]').click()
  await expect.poll(() => rows.count(), { timeout: 10_000 }).toBeGreaterThan(before)
})

test('search batch API: rejects malformed input with 400', { tag: '@desktop-only' }, async ({ request }) => {
  const bad = await request.get('/api/search/batch?search=dog&sort=newest&cursor=not-a-cursor')
  expect(bad.status()).toBe(400)
  const relevanceWithCursor = await request.get('/api/search/batch?search=dog&cursor=eyJ2IjoxLCJzIjoibmV3ZXN0IiwiZCI6IjIwMjQtMDEtMDEiLCJpIjoiYSJ9')
  expect(relevanceWithCursor.status()).toBe(400)
  const noSearch = await request.get('/api/search/batch?sort=newest')
  expect(noSearch.status()).toBe(400)
})

// ─── Mobile bottom-nav Search opens the search box (it used to just go home) ────
test('mobile bottom nav: Search opens and focuses the search box', { tag: '@mobile-only' }, async ({ page }) => {
  // On the results page: opens in place, results and URL kept
  await page.goto('/?search=pyometra')
  await expect(page.locator('[data-testid="sort-relevance"]')).toBeVisible({ timeout: 20_000 })
  const url = page.url()
  await page.getByRole('link', { name: 'Search' }).last().click()
  const input = page.locator('[data-testid="search-input"]')
  await expect(input).toBeFocused()
  expect(page.url()).toBe(url)
  // From the feed with the box closed: opens it
  await page.goto('/?browse=1')
  await expect(page.locator('[data-testid="search-toggle"]')).toBeVisible()
  await page.getByRole('link', { name: 'Search' }).last().click()
  await expect(input).toBeFocused()
  await input.fill('otitis')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/search=otitis/)
  // Arriving from another page (the link the nav uses off '/'): box open + focused, and the
  // one-shot focus param removed from the URL
  await page.goto('/?browse=1&focus=search')
  await expect(input).toBeFocused()
  await expect(page).not.toHaveURL(/focus=search/)
})

// ─── Landing sample card is a real article with its real evidence badge ────────
// It used to show a hardcoded "RCT / Meta-analysis" badge on whatever article was newest.
test('landing: sample card badge matches the article it links to', { tag: '@desktop-only' }, async ({ page, context }) => {
  await clearCookiesKeepPreviewAccess(context)
  await page.goto('/')
  const badge = (await page.locator('[data-testid="landing-sample-badge"]').textContent())?.trim()
  expect(badge).toBeTruthy()
  const link = page.locator('[data-testid="landing-sample-link"]')
  await expect(link).toHaveAttribute('href', /\/article\//)
  await link.click()
  await expect(page.locator('[data-testid="article-title"]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-testid="article-evidence-badge"]')).toContainText(badge!)
})

// ─── Guest Save buttons all enter the save / sign-in flow ─────────────────────
// Each Save entry point used to do nothing (article header), hide itself (feed rows, cards)
// or link to signup without completing the save. The prompt must return to the article
// with the save still pending (?intent=save).
async function expectSavePrompt(page: import('@playwright/test').Page, articlePath: RegExp) {
  const prompt = page.locator('[data-testid="save-auth-prompt"]')
  await expect(prompt).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(articlePath)
  const links = await prompt.locator('a[href]').evaluateAll(as => as.map(a => decodeURIComponent((a as HTMLAnchorElement).href)))
  const auth = links.filter(h => /\/(login|signup)/.test(h))
  expect(auth.some(h => h.includes('/login')), 'prompt offers sign in').toBe(true)
  expect(auth.some(h => h.includes('/signup')), 'prompt offers sign up').toBe(true)
  for (const h of auth) expect(h, 'every auth link returns with the save pending').toContain('intent=save')
}

test('guest save: article-page Save opens the sign-in prompt', async ({ page, context, request }) => {
  await clearCookiesKeepPreviewAccess(context)
  const [id] = await sitemapArticleIds(request)
  await page.goto(`/article/${id}`)
  await expect(page.locator('[data-testid="article-title"]')).toBeVisible()
  // Same header button on every width (icon-only on phones)
  await page.locator('[data-testid="appbar-save"]').click()
  await expectSavePrompt(page, new RegExp(`/article/${id}`))
})

test('guest save: list-view card bookmark opens the article with the sign-in prompt', async ({ page, context }) => {
  await clearCookiesKeepPreviewAccess(context)
  await page.goto('/?browse=1&view=list')
  const card = page.locator('[data-testid="card-save"]').first()
  await expect(card).toBeVisible({ timeout: 15_000 })
  await card.click()
  await expectSavePrompt(page, /\/article\//)
})

test('guest save: feed row bookmark opens the article with the sign-in prompt', async ({ page, context }) => {
  await clearCookiesKeepPreviewAccess(context)
  await page.goto('/?browse=1')
  const row = page.locator('[data-testid="row-save"]').first()
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.click()
  await expectSavePrompt(page, /\/article\//)
})

// ─── Consent can only be recorded for yourself ─────────────────────────────────
// The endpoint used to accept any body userId, so anyone could opt any user into the digest.
// Without a session it must refuse — and a refusal writes nothing, so this is safe on production.
test('consent endpoint refuses requests without a session', { tag: '@desktop-only' }, async ({ request }) => {
  const res = await request.post('/api/auth/save-consent', {
    data: { userId: '00000000-0000-4000-8000-000000000000', termsAccepted: true, marketingOptIn: true, consentSource: 'signup' },
  })
  expect(res.status()).toBe(401)
})

// ─── Synthesis auto-runs for readers, but never for automated browsers ───────────
// Smoke traffic must neither spend a Claude call nor count as an experiment run (it did until
// 2026-09-28). Deliberately never clicks the button.
test('search: synthesis does not auto-run in an automated browser; the button is offered', { tag: '@desktop-only' }, async ({ page }) => {
  let synthesisRequests = 0
  page.on('request', r => { if (r.url().includes('/api/synthesis/generate')) synthesisRequests++ })
  await page.goto('/?search=pyometra')
  await expect(page.locator('[data-testid="sort-relevance"]')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-testid="synthesis-open"]')).toBeVisible()
  await page.waitForTimeout(2000)
  expect(synthesisRequests, 'automated traffic must never start a synthesis').toBe(0)
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
test('mobile header: open search causes no horizontal scroll and zoom is allowed', { tag: '@mobile-only' }, async ({ page }) => {
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

// ─── Mobile article page: app bar fits the screen for signed-out visitors ────
test('mobile article page: no horizontal scroll for guests', { tag: '@mobile-only' }, async ({ page, context, request }) => {
  await clearCookiesKeepPreviewAccess(context)
  const [id] = await sitemapArticleIds(request)
  await page.goto(`/article/${id}`)
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()
  // The device's own width, then the narrowest common phone
  for (const width of [page.viewportSize()!.width, 320]) {
    await page.setViewportSize({ width, height: 800 })
    const m = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }))
    expect(m.scrollW, `article page must not scroll sideways at ${width}px`).toBeLessThanOrEqual(m.innerW)
  }
  // Icon-only controls on phones keep their accessible names
  await expect(page.getByRole('link', { name: 'Back to Stream' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save to library' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Share' })).toBeVisible()
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

// Article ids from the first sitemap shard, fetched ONCE per worker and shared by every test that
// only needs "some published article" (the shard is ~0.9 MB; four tests used to download it each).
// Uses the request fixture, so on a protected preview it carries the bypass cookie too.
let sitemapIdsCache: string[] | null = null
async function sitemapArticleIds(request: import('@playwright/test').APIRequestContext): Promise<string[]> {
  if (sitemapIdsCache) return sitemapIdsCache
  const index = await (await request.get('/sitemap.xml')).text()
  const shard = index.match(/<loc>https?:\/\/[^/]+(\/sitemaps\/sitemap\/\d+\.xml)<\/loc>/)
  expect(shard, 'Sitemap index must list at least one article shard').not.toBeNull()
  const xml = await (await request.get(shard![1])).text()
  const ids = [...xml.matchAll(/<loc>https?:\/\/[^/]+\/article\/([^<]+)<\/loc>/g)].map(m => m[1])
  expect(ids.length, 'Sitemap must contain at least one /article/ URL').toBeGreaterThan(0)
  sitemapIdsCache = ids
  return ids
}

// ─── Original abstract: collapsed, loaded on open, attributed ────────────────
test('article page: original abstract loads on open with PubMed attribution', async ({ page, request }) => {
  // Most articles have an abstract; a few kept-for-reference ones don't — probe one at a time and
  // stop at the first that does (usually the first), instead of 15 parallel requests + a re-fetch
  let id: string | null = null
  let abstract = ''
  for (const candidate of (await sitemapArticleIds(request)).slice(0, 15)) {
    const res = await request.get(`/api/articles/${candidate}/abstract`)
    const body = res.ok() ? await res.json() : null
    if (body?.abstract) { id = candidate; abstract = body.abstract; break }
  }
  expect(id, 'one of the first sitemap articles must have a stored abstract').not.toBeNull()

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
test('save-intent (logged out): auth sheet appears, intent stripped, links are valid', async ({ page, context, request }) => {
  // Heavy by design: the article, then every auth link in its own page (the sitemap is shared
  // per worker). Under a full parallel run it has crossed the 30 s default.
  test.setTimeout(60_000)
  await clearCookiesKeepPreviewAccess(context)

  const [articleId] = await sitemapArticleIds(request)
  const articlePath = '/article/' + articleId

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
test('auth round-trip: intent=save saves article, appears in library, unsave removes it', { tag: '@desktop-only' }, async ({ page, context }) => {
  test.skip(!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD, 'gated on missing TEST_USER_EMAIL/TEST_USER_PASSWORD')

  await page.goto('/login')
  await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL!)
  await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD!)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 })

  // Logged-in users see the full feed at /
  await page.goto('/')
  // PR, post-deploy and scheduled runs share this test account and can overlap, so a run must
  // never touch another run's save: it picks, in random order, an internal article the account
  // has NOT saved (per the server, not the button), and only ever unsaves that one. An article
  // that is already saved — another run's, or a crashed run's — is skipped, never unsaved.
  // Residual risk: two runs picking the same unsaved article within seconds → a false red that a
  // rerun clears, never a false green. (Not a GitHub concurrency group: it cancels queued runs,
  // which would leave PRs' required check cancelled.)
  const links = page.locator('[data-testid="article-card"] a[href^="/article/"]')
  await links.first().waitFor({ timeout: 15_000 })
  const ids = [...new Set((await links.evaluateAll(as => as.map(a => a.getAttribute('href') || '')))
    .map(h => h.match(/^\/article\/([^/?#]+)/)?.[1])
    .filter((id): id is string => !!id))]
  const savedRes = await page.request.get('/api/saved-articles')
  expect(savedRes.ok(), 'saved-articles lookup must succeed').toBe(true)
  const saved = new Set<string>((await savedRes.json()).articleIds ?? [])
  const candidates = ids.filter(id => !saved.has(id))
  expect(candidates.length, 'the feed must offer an article the test account has not saved').toBeGreaterThan(0)
  const articleId = candidates[Math.floor(Math.random() * candidates.length)]

  // The save-article response for THIS article and action. `changed` (app/api/save-article)
  // proves this run's own request inserted/deleted the row — not another run's.
  const saveResponse = (action: 'save' | 'unsave') => page.waitForResponse(r => {
    if (!r.url().includes('/api/save-article') || r.request().method() !== 'POST') return false
    const body = r.request().postDataJSON?.() as { articleId?: string; action?: string } | null
    return body?.articleId === articleId && body?.action === action
  }, { timeout: 15_000 })

  // Armed only after this run's own insertion is confirmed, disarmed after its own unsave is
  // confirmed, so cleanup only removes this run's save. (Edge: if an unsave commits but its
  // response is lost, cleanup could remove a later run's save of the same article — that run
  // then fails conservatively; it can't pass falsely.)
  let ownsSave = false
  try {
    // Visit with intent=save: SaveIntentHandler saves and shows a toast or the first-save shelf
    const saved1 = saveResponse('save')
    await page.goto(`/article/${articleId}?intent=save`)
    const saveRes = await saved1
    expect(saveRes.ok(), 'save request must succeed').toBe(true)
    // A collision with an overlapping run (it saved this article first) fails here — conservatively
    expect((await saveRes.json()).changed, 'this run must have inserted the save itself').toBe(true)
    ownsSave = true
    await expect(
      page.locator('[data-testid="save-toast"]').or(page.locator('[data-testid="first-save-shelf"]'))
    ).toBeVisible({ timeout: 15_000 })

    // Verify in library
    await page.goto('/library')
    await expect(page.locator(`[href="/article/${articleId}"], [href*="${articleId}"]`).first()).toBeVisible({ timeout: 8_000 })

    // Unsave — wait for this run's own delete to be confirmed, not just the optimistic UI
    await page.goto(`/article/${articleId}`)
    const unsaveBtn = page.locator('[aria-label="Remove from library"], [aria-label="Unsave"]').first()
    await expect(unsaveBtn).toBeVisible({ timeout: 6_000 })
    const unsaved = saveResponse('unsave')
    await unsaveBtn.click()
    const unsaveRes = await unsaved
    expect(unsaveRes.ok(), 'unsave request must succeed').toBe(true)
    expect((await unsaveRes.json()).changed, 'this run must have deleted its own save').toBe(true)
    ownsSave = false

    // Verify removed from library
    await page.goto('/library')
    await expect(page.locator(`[href="/article/${articleId}"], [href*="${articleId}"]`).first()).not.toBeVisible({ timeout: 6_000 })

  } finally {
    // Only a save this run inserted and has not yet removed
    if (ownsSave) {
      try {
        await page.request.post('/api/save-article', { data: { articleId, action: 'unsave' } })
      } catch { /* best-effort */ }
    }
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
  test(`protected route ${path}: anonymous visitor is redirected to /login`, { tag: '@desktop-only' }, async ({ page, context }) => {
    await clearCookiesKeepPreviewAccess(context)
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
  })
}

// ─── 6. Sitemap + robots ─────────────────────────────────────────────────────
test('sitemap and robots.txt: 200 and valid content', { tag: '@desktop-only' }, async ({ page }) => {
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
