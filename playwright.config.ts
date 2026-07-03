import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'https://vetree.app'

export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  timeout: 30_000,
  retries: 1,
  reporter: [
    ['json', { outputFile: 'playwright-results.json' }],
    ['line'],
  ],
  use: {
    baseURL: BASE_URL,
    // Sent on all requests — browser + API request context — for analytics exclusion
    extraHTTPHeaders: { 'x-qa-bot': '1' },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Override device UA so the analytics route can detect and skip bot traffic
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 VetreeQABot/1.0',
      },
    },
  ],
})
