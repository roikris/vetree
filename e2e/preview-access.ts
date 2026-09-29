import type { BrowserContext } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { BYPASS_STATE } from './global-setup'

/**
 * Clears every cookie (a logged-out guest), then restores the Vercel preview-protection bypass
 * cookie saved by e2e/global-setup.ts — without it a protected preview serves Vercel's login page.
 * On production or local runs there is no saved state, so this is a plain clearCookies().
 */
export async function clearCookiesKeepPreviewAccess(context: BrowserContext) {
  await context.clearCookies()
  if (!existsSync(BYPASS_STATE)) return
  const { cookies } = JSON.parse(readFileSync(BYPASS_STATE, 'utf8'))
  if (Array.isArray(cookies) && cookies.length > 0) await context.addCookies(cookies)
}
