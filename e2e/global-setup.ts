import { request, type FullConfig } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Preview deployments are behind Vercel Deployment Protection: they share the production database,
 * so nobody outside CI may reach them. CI holds VERCEL_AUTOMATION_BYPASS_SECRET.
 *
 * The secret is sent exactly once, here, to the preview origin only. Vercel answers with a redirect
 * carrying a bypass cookie for the preview host, saved as the tests' storageState. The secret is
 * never set as a global header: Playwright's extraHTTPHeaders go to EVERY origin a page contacts
 * (Supabase auth, third-party scripts), which would leak a credential that bypasses protection
 * project-wide.
 */
export const BYPASS_STATE = 'playwright/.auth/vercel-bypass.json'

export default async function globalSetup(_config: FullConfig) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const baseURL = process.env.SMOKE_BASE_URL
  if (!secret || !baseURL) return

  // Only ever for a Vercel preview host — never production, a custom domain, or localhost
  const url = new URL(baseURL)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) {
    throw new Error(`Refusing to send the Vercel bypass secret to ${url.origin} (not a *.vercel.app preview)`)
  }
  const host = url.hostname

  const exchange = await request.newContext()
  const res = await exchange.get(new URL('/', url).toString(), {
    headers: { 'x-vercel-protection-bypass': secret, 'x-vercel-set-bypass-cookie': 'true' },
    maxRedirects: 0,   // Vercel answers with a redirect that sets the cookie; no need to follow it
  })
  const state = await exchange.storageState()
  await exchange.dispose()

  // Keep only cookies for exactly the preview host, host-only (no leading dot → no subdomains)
  state.cookies = state.cookies
    .filter(c => c.domain.replace(/^\./, '') === host)
    .map(c => ({ ...c, domain: host }))
  state.origins = []
  if (state.cookies.length === 0) {
    throw new Error(`Vercel set no bypass cookie for ${host} (HTTP ${res.status()}) — check VERCEL_AUTOMATION_BYPASS_SECRET`)
  }

  // Prove the cookie alone (no secret) opens the preview
  const check = await request.newContext({ storageState: state })
  const ok = await check.get(new URL('/', url).toString(), { maxRedirects: 0 })
  await check.dispose()
  if (ok.status() !== 200) {
    throw new Error(`Preview returned HTTP ${ok.status()} with the bypass cookie — protection bypass is not working`)
  }

  mkdirSync(dirname(BYPASS_STATE), { recursive: true })
  writeFileSync(BYPASS_STATE, JSON.stringify(state))
}
