import { defineConfig, devices } from '@playwright/test'

// Every Playwright run is tagged as QA traffic so analytics excludes it (/api/analytics/track and
// /api/analytics/search skip user agents containing "VetreeQABot"). The tag is APPENDED to each
// device's own user agent: a top-level `userAgent` is overridden by the device profiles below, which
// is why smoke searches ("bovine mastitis", "pyometra", "dog") were being logged as real searches.
// An optional SMOKE_USER_AGENT label (e.g. vetree-smoke-pr) is appended as well.
const qaTag = ['VetreeQABot', process.env.SMOKE_USER_AGENT].filter(Boolean).join(' ')
const tagged = (device: (typeof devices)[string]) => ({ ...device, userAgent: `${device.userAgent} ${qaTag}` })

// Protected preview: e2e/global-setup.ts exchanges the bypass secret for a host-scoped cookie
const useBypass = !!(process.env.VERCEL_AUTOMATION_BYPASS_SECRET && process.env.SMOKE_BASE_URL)

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'playwright-report/results.json' }]],
  use: {
    baseURL: process.env.SMOKE_BASE_URL || 'https://vetree.app',
    trace: 'on-first-retry',
    ...(useBypass ? { storageState: 'playwright/.auth/vercel-bypass.json' } : {}),
  },
  projects: [
    {
      name: 'desktop',
      use: tagged(devices['Desktop Chrome']),
    },
    {
      name: 'mobile',
      use: tagged(devices['Pixel 7']),
    },
  ],
})
