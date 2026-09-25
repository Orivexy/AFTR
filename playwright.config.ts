import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a seeded database (`npm run db:reset`).
 * Set E2E_BASE_URL to test a deployed instance; otherwise `npm run dev` is started.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } }, testMatch: /guest|admin/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "RATE_LIMIT_SCALE=20 npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
