import { defineConfig, devices } from '@playwright/test'

// Every Playwright run is tagged as QA traffic so analytics excludes it (/api/analytics/track and
// /api/analytics/search skip user agents containing "VetreeQABot"). The tag is APPENDED to each
// device's own user agent: a top-level `userAgent` is overridden by the device profiles below, which
// is why smoke searches ("bovine mastitis", "pyometra", "dog") were being logged as real searches.
// An optional SMOKE_USER_AGENT label (e.g. vetree-smoke-pr) is appended as well.
const qaTag = ['VetreeQABot', process.env.SMOKE_USER_AGENT].filter(Boolean).join(' ')
const tagged = (device: (typeof devices)[string]) => ({ ...device, userAgent: `${device.userAgent} ${qaTag}` })

export default defineConfig({
  testDir: './e2e',
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'playwright-report/results.json' }]],
  use: {
    baseURL: process.env.SMOKE_BASE_URL || 'https://vetree.app',
    trace: 'on-first-retry',
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
