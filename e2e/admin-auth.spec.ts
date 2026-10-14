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
  '/api/admin/pipeline/status',
  '/api/articles/search-quick?q=canine',
]

for (const path of ADMIN_ROUTES_GET) {
  test(`admin auth: GET ${path} rejects anonymous access`, { tag: '@desktop-only' }, async ({ request }) => {
    const response = await request.get(path)
    expect(response.status()).toBe(401)
    expect(await response.json()).toEqual(UNAUTHORIZED_BODY)
  })
}

// The write case. The guard must answer before anything is touched — and if it ever regresses, the
// request deletes nothing: the id is a fixed UUID no article has. (It used to be POST
// /api/admin/fix-incomplete, removed with Article Health in admin-002.) One project only, no retries.
const NO_SUCH_ARTICLE = '00000000-0000-4000-8000-000000000000'

test.describe('admin auth: write endpoint', () => {
  test.describe.configure({ retries: 0 })

  test('DELETE /api/admin/articles/[id] rejects anonymous access', { tag: '@desktop-only' }, async ({ request }) => {
    const response = await request.delete(`/api/admin/articles/${NO_SUCH_ARTICLE}`)
    expect(response.status()).toBe(401)
    expect(await response.json()).toEqual({ error: 'Not authenticated' })
  })
})
