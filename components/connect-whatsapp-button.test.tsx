// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

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
  const launchEmbeddedSignup = vi.fn()

  class EmbeddedSignupCancelledError extends Error {
    constructor(readonly cancel: unknown) {
      super("cancelled")
    }
  }

  beforeEach(() => {
    vi.resetModules()
    launchEmbeddedSignup.mockReset()
    vi.doMock("@/lib/facebook-sdk", () => ({
      embeddedSignupReady: true,
      launchEmbeddedSignup,
      loadFacebookSdk: vi.fn(() => Promise.resolve({})),
      EmbeddedSignupCancelledError,
    }))
  })

  it("renders the real action, enabled", async () => {
    await renderButton()

    const button = screen.getByRole("button", { name: /connect whatsapp/i })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("asks which kind of number before opening Meta's popup", async () => {
    launchEmbeddedSignup.mockReturnValue(new Promise(() => {}))
    await renderButton()

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    expect(launchEmbeddedSignup).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("radio", { name: /my whatsapp business app number/i }))
    fireEvent.click(screen.getByRole("button", { name: /continue with facebook/i }))
    expect(launchEmbeddedSignup).toHaveBeenCalledWith("coexistence")
    // Stays with the user while Meta's window is open.
    expect(await screen.findByText(/finish in the facebook window/i)).toBeTruthy()
  })

  it("keeps the step-by-step setup one link away", async () => {
    await renderButton()
    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    expect(screen.getByRole("link", { name: /guided setup/i })).toHaveProperty(
      "href",
      expect.stringContaining("/dashboard/whatsapp/new")
    )
  })

  it("goes straight to the popup for a reconnect", async () => {
    launchEmbeddedSignup.mockReturnValue(new Promise(() => {}))
    await renderButton({ askNumberType: false })

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    expect(launchEmbeddedSignup).toHaveBeenCalledWith("new")
  })

  it("shows the result when the connection succeeds", async () => {
    const onSuccess = vi.fn()
    launchEmbeddedSignup.mockResolvedValueOnce({ code: "c" })
    const { submitEmbeddedSignup } = await import("@/services/api")
    vi.mocked(submitEmbeddedSignup).mockResolvedValueOnce({
      accountId: "a",
      wabaId: "w",
      phoneNumberId: "p",
      status: "verified",
      registered: true,
    })
    await renderButton({ onSuccess })

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    fireEvent.click(screen.getByRole("button", { name: /continue with facebook/i }))

    expect(await screen.findByText(/whatsapp is connected/i)).toBeTruthy()
    expect(onSuccess).toHaveBeenCalled()
  })

  it("explains a number still on WhatsApp and offers the Business app route", async () => {
    launchEmbeddedSignup.mockRejectedValueOnce(
      new EmbeddedSignupCancelledError({
        errorMessage: "This phone number is already registered to a WhatsApp account.",
      })
    )
    await renderButton()

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    fireEvent.click(screen.getByRole("button", { name: /continue with facebook/i }))

    expect(await screen.findByText(/this number is already on whatsapp/i)).toBeTruthy()

    launchEmbeddedSignup.mockReturnValue(new Promise(() => {}))
    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp business app/i }))
    await waitFor(() => expect(launchEmbeddedSignup).toHaveBeenLastCalledWith("coexistence"))
  })

  it("returns to the choice, with a note, when the Facebook window is closed", async () => {
    launchEmbeddedSignup.mockRejectedValueOnce(new EmbeddedSignupCancelledError(null))
    await renderButton()

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    fireEvent.click(screen.getByRole("button", { name: /continue with facebook/i }))

    expect(await screen.findByText(/closed before setup finished/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: /continue with facebook/i })).toBeTruthy()
  })
})
