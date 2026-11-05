/**
 * The page tests: test/page/, in a real browser against the real Worker. `npm run test:page`;
 * the first time, `npx playwright install chromium` fetches the browser.
 *
 * Two at a time, here and in CI: each Playwright worker is a browser drawing the shrine's live scene
 * without a GPU, plus a Worker of its own (test/support/page.js), and more of them than that starve
 * each other on a laptop or a 4-core runner until clicks time out.
 */
import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'test/page',
  testMatch: '*.spec.js',
  outputDir: 'test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: CI,
  retries: 0, // a test that needs a second try is a test to fix
  workers: 2,
  reporter: CI ? [['list'], ['github']] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
});
