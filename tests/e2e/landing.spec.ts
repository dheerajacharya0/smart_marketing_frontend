import { test, expect, type Page } from "@playwright/test"

/**
 * Public landing page (app/page.tsx). Runs against the frontend alone: the
 * waitlist POST is intercepted, so no webhook is needed.
 */


/**
 * Navigate and wait for hydration: until then React has no handlers attached
 * and clicks are silently lost (flaky under a loaded dev server). The theme
 * toggle flips `data-ready` once mounted, and the page hydrates as one root.
 */
async function gotoReady(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("button", { name: /switch light or dark theme/i })).toHaveAttribute("data-ready", "true", {
    timeout: 20_000,
  })
}

const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 800 },
]

for (const vp of VIEWPORTS) {
  test.describe(`landing @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test("never scrolls sideways", async ({ page }) => {
      await page.goto("/")
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test("phone mockups fit on screen", async ({ page }) => {
      // Regression: the swipeable use-case pills widened the grid track and
      // pushed the phone half off-screen. The page clips sideways overflow, so
      // the scrollWidth check above can't see this — measure the phones.
      // Measured in place: the hero phone floats forever, so Playwright's
      // scroll-into-view (which waits for the element to be still) never returns.
      await page.goto("/")
      const boxes = await page.evaluate(() =>
        [...document.querySelectorAll(".lp-wa-wall")]
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => {
            const r = el.getBoundingClientRect()
            return { left: r.left, right: r.right }
          }),
      )
      expect(boxes.length).toBeGreaterThan(0)
      for (const b of boxes) {
        expect(b.left).toBeGreaterThanOrEqual(0)
        expect(b.right).toBeLessThanOrEqual(vp.width)
      }
    })

    test("email field keeps a usable height", async ({ page }) => {
      // Regression: `flex-1` inside the stacked (column) layout collapsed it to ~21px on phones.
      await page.goto("/")
      const box = await page.getByRole("textbox", { name: "Email address" }).first().boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    })
  })
}

test("theme toggle switches and remembers light/dark", async ({ page }) => {
  await gotoReady(page, "/")
  const theme = () => page.evaluate(() => document.documentElement.dataset.lpTheme)
  const before = await theme()
  await page.getByRole("button", { name: /switch light or dark theme/i }).click()
  // The switch runs inside a view transition, whose update callback is async.
  await expect.poll(theme).not.toBe(before)
  const after = await theme()
  await page.reload({ waitUntil: "domcontentloaded" })
  expect(await page.evaluate(() => document.documentElement.dataset.lpTheme)).toBe(after)
})

test("calculator keypad updates the comparison", async ({ page }) => {
  await gotoReady(page, "/#calculator")
  await page.getByRole("button", { name: "Clear" }).click()
  for (const key of ["1", "000", "00"]) await page.getByRole("button", { name: key, exact: true }).click()
  await expect(page.locator(".lp-lcd-text")).toContainText("1,00,000")
  await page.getByRole("radio", { name: "Utility" }).click()
  // 1,00,000 utility messages at ₹0.115 — Converszio's total is Meta's bill alone.
  await expect(page.getByText("₹11,500").first()).toBeVisible()
})

test("scratch card reveals the hidden markup", async ({ page }) => {
  await gotoReady(page, "/#reveal")
  await page.getByRole("button", { name: /reveal it/i }).click()
  await expect(page.getByText(/That line costs you/)).toBeVisible()
  await expect(page.getByText("ON CONVERSZIO", { exact: true })).toBeVisible()
})

test("waitlist signup shows confirmation", async ({ page }) => {
  let body: unknown
  await page.route("**/api/waitlist", async (route) => {
    body = route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
  })
  await gotoReady(page, "/")
  await page.getByRole("textbox", { name: "Email address" }).first().fill("founder@example.com")
  await page.getByRole("button", { name: /get early access/i }).first().click()
  await expect(page.getByText(/you're on the list/i)).toBeVisible()
  expect(body).toMatchObject({ email: "founder@example.com", source: "hero" })
})

test("waitlist surfaces a server error instead of fake success", async ({ page }) => {
  await page.route("**/api/waitlist", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Signups aren\'t open yet."}' }),
  )
  await gotoReady(page, "/")
  await page.getByRole("textbox", { name: "Email address" }).first().fill("founder@example.com")
  await page.getByRole("button", { name: /get early access/i }).first().click()
  // Scoped to the form: Next's route announcer is also role=alert.
  await expect(page.locator("form").first().getByRole("alert")).toContainText("Signups aren't open yet.")
})

test("FAQ answers the markup question", async ({ page }) => {
  await gotoReady(page, "/#faq")
  await page.getByText("If there's no markup, how does Converszio make money?").click()
  await expect(page.getByText(/never from a cut of your messages/)).toBeVisible()
})

test("privacy notice is public", async ({ page }) => {
  await page.goto("/privacy")
  await expect(page.getByRole("heading", { name: /waitlist privacy notice/i })).toBeVisible()
})
