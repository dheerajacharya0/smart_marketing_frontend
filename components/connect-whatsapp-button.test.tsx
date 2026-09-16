// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

/**
 * Cover for what the button does when Embedded Signup is *not* configured.
 *
 * That state is not hypothetical: production shipped with
 * NEXT_PUBLIC_FACEBOOK_APP_ID and NEXT_PUBLIC_FACEBOOK_ES_CONFIG_ID both empty,
 * so `embeddedSignupReady` was false, and the setup checklist's step 1 — whose
 * only affordance is this button — rendered permanently disabled with nothing
 * to explain it. The behaviour under test is the escape hatch: link to the
 * OAuth path, which needs no frontend Meta credentials.
 *
 * `embeddedSignupReady` is a module-level const computed from build-time env,
 * so it cannot be flipped by setting a variable — the module has to be mocked
 * and re-imported per case.
 */

vi.mock("@/lib/facebook-sdk", () => ({
  embeddedSignupReady: false,
  launchEmbeddedSignup: vi.fn(),
}))

vi.mock("@/services/api", () => ({
  submitEmbeddedSignup: vi.fn(),
}))

afterEach(cleanup)

async function renderButton(props: Record<string, unknown> = {}) {
  const { ConnectWhatsAppButton } = await import("./connect-whatsapp-button")
  render(<ConnectWhatsAppButton {...props} />)
}

describe("ConnectWhatsAppButton when Embedded Signup is unconfigured", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("links to the OAuth onboarding path instead of disabling itself", async () => {
    await renderButton()

    const link = screen.getByRole("link", { name: /connect whatsapp/i })
    expect(link).toHaveProperty("href", expect.stringContaining("/dashboard/whatsapp/new"))
    // The regression: no dead control anywhere in the output.
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("keeps the caller's label on the fallback", async () => {
    await renderButton({ label: "Connect" })

    expect(screen.getByRole("link", { name: "Connect" })).toBeTruthy()
  })

  it("renders nothing where the caller already offers that route", async () => {
    await renderButton({ unconfiguredFallback: "hide" })

    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
  })
})

describe("ConnectWhatsAppButton when Embedded Signup is configured", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock("@/lib/facebook-sdk", () => ({
      embeddedSignupReady: true,
      launchEmbeddedSignup: vi.fn(),
    }))
  })

  it("renders the real action, enabled", async () => {
    await renderButton()

    const button = screen.getByRole("button", { name: /connect whatsapp/i })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByRole("link")).toBeNull()
  })
})
