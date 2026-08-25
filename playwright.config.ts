import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright smoke tests (Phase 5). These need the app running (and a backend
 * for authenticated flows). Run with `yarn test:e2e`; set E2E_BASE_URL to point
 * at a running instance, or let webServer boot `yarn dev` locally.
 */
// Port 3001, not 3000: the backend owns 3000 in local development (it is the
// dev fallback for NEXT_PUBLIC_API_BASE_URL in `lib/env.ts`), so `yarn dev`
// finds it taken and quietly moves to another port — while this config went on
// polling 3000 until `webServer` timed out, reporting three failed specs that
// had never run. Pin the port on both sides so they cannot drift apart.
const PORT = process.env.E2E_PORT || "3001"
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`

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
        command: `yarn dev --port ${PORT}`,
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
})
