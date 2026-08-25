import { test, expect } from "@playwright/test"

/**
 * Critical-flow smoke tests (Phase 5). Unauthenticated checks run against just
 * the frontend; the authenticated flows (chat/campaign/import) require a backend
 * and seeded credentials via env (E2E_EMAIL / E2E_PASSWORD) — they self-skip
 * when those are absent so the suite still passes in a frontend-only CI.
 */

test.describe("public routes", () => {
  test("login page renders its form", async ({ page }) => {
    await page.goto("/login")
    // Scope to the form: the page also carries a login/signup segmented control
    // whose first button is likewise labelled "Sign in", so an unscoped role
    // query matches two elements and fails on strict mode.
    const form = page.locator("form")
    await expect(form.getByRole("button", { name: /sign in|log in/i })).toBeVisible()
    await expect(form.getByRole("textbox", { name: /email/i })).toBeVisible()
  })

  test("unauthenticated dashboard redirects to login (edge middleware)", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })

  test("unknown route shows the not-found boundary", async ({ page }) => {
    await page.goto("/this-route-does-not-exist")
    await expect(page.getByText(/page not found/i)).toBeVisible()
  })
})

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test.describe("authenticated flows", () => {
  test.skip(!email || !password, "set E2E_EMAIL/E2E_PASSWORD to run authenticated smoke tests")

  test("login lands on the dashboard", async ({ page }) => {
    await page.goto("/login")
    const form = page.locator("form")
    await form.getByRole("textbox", { name: /email/i }).fill(email as string)
    await form.getByLabel(/password/i).fill(password as string)
    await form.getByRole("button", { name: /sign in|log in/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
