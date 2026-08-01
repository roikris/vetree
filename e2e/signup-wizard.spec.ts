/**
 * signup-wizard.spec.ts
 *
 * Full front-door regression test for the Phase 5 onboarding wizard
 * (app/signup/page.tsx). 31 consecutive sessions reached /signup after the
 * 2026-07-03 redesign and zero completed, vs ~50% before it. The signup
 * machine's alibi has to come from driving the real UI through all 4 steps
 * — an API-level check (calling supabase.auth.signUp() directly) would prove
 * the backend works and say nothing about the wizard itself, which is where
 * the regression almost certainly is (see the responsive-layout and
 * error-visibility fixes in this same PR).
 *
 * Runs on both the "desktop" and "mobile" Playwright projects (playwright.config.ts)
 * with no per-test device code needed — `npx playwright test` executes every
 * spec under every configured project unless filtered with --project.
 *
 * GATED: requires SUPABASE_SERVICE_ROLE_KEY (to delete the throwaway account
 * afterward) + NEXT_PUBLIC_SUPABASE_URL. Skipped automatically in CI (smoke
 * suite) where the service key is absent — this test creates and deletes a
 * real auth user, so it should only be run deliberately against a preview
 * or staging environment.
 *
 * Run manually on a preview URL:
 *   SMOKE_BASE_URL=https://preview-xxx.vetree.app \
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx playwright test e2e/signup-wizard.spec.ts
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const GATE_MISSING = !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL

test.describe('signup wizard: real UI, all 4 steps, email path', () => {
  test.skip(GATE_MISSING, 'gated on missing SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_URL')

  test('completes the wizard front-to-back and reaches email verification', async ({ page }) => {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    // NOT @example.com: Supabase Auth's confirmation-email send fails synchronously
    // against RFC 2606 reserved domains (no MX record) and the whole signup call
    // 500s — see this PR's fix in handleCreateAccount for the "{}" this produces
    // when rendered verbatim. gmail.com accepts the send (queues it; any bounce
    // happens async, after signup already returned 200) — confirmed manually
    // before writing this test. The random local-part makes collision with a
    // real inbox astronomically unlikely, same convention as other throwaway
    // test accounts already in this codebase (e.g. roi.kris+smoketest@gmail.com).
    const email = `vetree-e2e-wizard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gmail.com`
    const password = 'Vetree-Test-Pw-1'
    let createdUserId: string | null = null

    try {
      await page.goto('/signup')

      // ── Step 1: Account ──
      await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()

      // Regression guard for the fixed-322px brand rail: on a narrow viewport it
      // used to leave the form ~2px wide (viewport minus rail minus padding) while
      // remaining technically present and clickable — Playwright's element handles
      // don't care about visual squish, so only an explicit width check catches it.
      const emailInput = page.locator('input[type="email"]')
      const viewportWidth = page.viewportSize()?.width ?? 0
      if (viewportWidth > 0 && viewportWidth < 768) {
        const box = await emailInput.boundingBox()
        expect(box?.width ?? 0, 'signup form must not be squeezed by the brand rail on a narrow viewport').toBeGreaterThan(200)
      }

      await emailInput.fill(email)
      const passwordInputs = page.locator('input[type="password"]')
      await passwordInputs.nth(0).fill(password)
      await passwordInputs.nth(1).fill(password)
      await page.locator('input[type="checkbox"]').check()
      await page.getByRole('button', { name: 'Create account' }).click()

      // ── Step 2: About you ──
      await expect(page.getByText('Tell us who you are.')).toBeVisible({ timeout: 20_000 })
      await page.getByRole('button', { name: 'Continue' }).click()

      // ── Step 3: Your grove ──
      await expect(page.getByText('Plant your branches.')).toBeVisible()
      await page.getByRole('button', { name: 'Continue' }).click()

      // ── Step 4: Ready ──
      await expect(page.getByText('Your grove is planted.')).toBeVisible()
      await page.getByRole('button', { name: 'Enter Vetree' }).click()

      // ── Pending verification screen — the wizard's actual finish line ──
      await expect(page.getByText('Check your email.')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(email)).toBeVisible()

      // Confirm the account genuinely exists server-side, not just that the UI
      // said so — same "front door, then verify" standard as the UI assertions.
      let found = null
      for (let page_ = 1; page_ <= 5 && !found; page_++) {
        const { data } = await supabaseAdmin.auth.admin.listUsers({ page: page_, perPage: 1000 })
        if (!data?.users?.length) break
        found = data.users.find(u => u.email === email) ?? null
        if (data.users.length < 1000) break
      }
      expect(found, 'account must exist in auth.users after completing the wizard').toBeTruthy()
      createdUserId = found!.id
    } finally {
      if (createdUserId) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId)
      }
    }
  })
})
