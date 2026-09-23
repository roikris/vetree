import { test, expect } from '@playwright/test'

// Regression coverage for three routes that shipped with the service-role key and
// NO authentication check, while app/api/CLAUDE.md documented all three as "Admin".
//
// These assertions are the empirical gate for that fix: they depend on what the
// deployed endpoint actually returns, not on anyone's reading of the code.
//
// Asserting the BODY as well as the status is deliberate. Vercel deployment
// protection also answers 401 at the edge, so a status-only assertion could pass
// on a preview without the application's guard ever executing — proving nothing.

const UNAUTHORIZED_BODY = { error: 'Unauthorized' }

const ADMIN_ROUTES_GET = [
  '/api/admin/incomplete-count',
  '/api/articles/search-quick?q=canine',
]

for (const path of ADMIN_ROUTES_GET) {
  test(`admin auth: GET ${path} rejects anonymous access`, async ({ request }) => {
    const response = await request.get(path)
    expect(response.status()).toBe(401)
    expect(await response.json()).toEqual(UNAUTHORIZED_BODY)
  })
}

// The POST case is the one that mutates. If the auth check ever regresses, this test
// performs the action it guards — re-queuing every incomplete article and resetting
// enrichment_attempts (no cap in the handler; ~344 rows at time of writing). That is
// accepted as the price of having regression coverage on a write endpoint that was
// publicly reachable, but the exposure is minimised: one project only, no retries.
// Without these, retries:1 across the desktop and mobile projects would allow four
// mutating attempts per suite run.
test.describe('admin auth: write endpoint', () => {
  test.describe.configure({ retries: 0 })

  test('POST /api/admin/fix-incomplete rejects anonymous access', async ({ request }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'Checked once per run to limit mutation exposure if the guard has regressed',
    )
    const response = await request.post('/api/admin/fix-incomplete')
    expect(response.status()).toBe(401)
    expect(await response.json()).toEqual(UNAUTHORIZED_BODY)
  })
})
