import { defineConfig } from '@playwright/test'

// End-to-end tests drive the real UI against the real backend.
// Start MySQL, the backend and `npm run dev` first, then run `npm run test:e2e`.
// Against another server: E2E_BASE_URL=https://… E2E_ADMIN_USER=admin E2E_ADMIN_PASSWORD=… npm run test:e2e
export default defineConfig({
  testDir: './e2e',
  // Tests share one database, so run files one after another
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    // Uses the Chrome already installed on the machine (no browser download needed)
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    // E2E_SCREENSHOTS=1 keeps a screenshot of every test's final screen as evidence
    screenshot: process.env.E2E_SCREENSHOTS ? 'on' : 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
