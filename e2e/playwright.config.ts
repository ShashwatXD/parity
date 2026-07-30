import { defineConfig, devices } from '@playwright/test';

const UI = process.env.E2E_UI_URL ?? 'http://127.0.0.1:3000';
const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:5005/api';

/**
 * Industry-standard Playwright E2E.
 * Assumes `npm run dev` (or prod builds) already running unless webServer is used.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: UI,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },
  projects: [
    {
      name: 'api',
      testMatch: /api\.spec\.ts/,
      use: { baseURL: API },
    },
    {
      name: 'chromium',
      testIgnore: /api\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Starts API+UI via monorepo `npm run dev` unless already running / E2E_NO_WEBSERVER=1
  webServer: process.env.E2E_NO_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev',
        cwd: '..',
        url: UI,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
