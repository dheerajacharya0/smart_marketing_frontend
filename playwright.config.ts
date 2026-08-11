import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright smoke tests (Phase 5). These need the app running (and a backend
 * for authenticated flows). Run with `yarn test:e2e`; set E2E_BASE_URL to point
 * at a running instance, or let webServer boot `yarn dev` locally.
 */
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Only auto-start the dev server when not targeting an external instance.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "yarn dev",
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
})
