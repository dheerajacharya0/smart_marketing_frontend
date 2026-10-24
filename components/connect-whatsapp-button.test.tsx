// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { EntitlementUsage, NumberAddon } from "@/services/api"

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
  isPlanLimitError: vi.fn(() => false),
}))

vi.mock("@/hooks/use-account-id", () => ({
  useAccountId: () => ({ accountId: "account-1", resolved: true, error: null }),
}))

const entitlementUsage = vi.fn<() => { data: EntitlementUsage | undefined }>(() => ({ data: undefined }))
const numberAddon = vi.fn<() => { data: NumberAddon | null | undefined }>(() => ({ data: undefined }))
vi.mock("@/hooks/use-queries", () => ({
  useEntitlementUsage: () => entitlementUsage(),
  useNumberAddon: () => numberAddon(),
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

  it("offers the step-by-step setup as a third choice", async () => {
    await renderButton()
    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    expect(screen.queryByRole("link", { name: /start guided setup/i })).toBeNull()

    fireEvent.click(screen.getByRole("radio", { name: /step-by-step setup/i }))

    // The main action becomes the wizard, and Meta's popup is not offered.
    expect(screen.getByRole("link", { name: /start guided setup/i })).toHaveProperty(
      "href",
      expect.stringContaining("/dashboard/whatsapp/new")
    )
    expect(screen.queryByRole("button", { name: /continue with facebook/i })).toBeNull()
    expect(launchEmbeddedSignup).not.toHaveBeenCalled()
  })

  it("goes straight to the popup for a reconnect", async () => {
    launchEmbeddedSignup.mockReturnValue(new Promise(() => {}))
    await renderButton({ askNumberType: false })

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    expect(launchEmbeddedSignup).toHaveBeenCalledWith("new")
  })

  it("opens the popup in the button's own mode without asking first", async () => {
    launchEmbeddedSignup.mockReturnValue(new Promise(() => {}))
    await renderButton({ mode: "coexistence" })

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    expect(launchEmbeddedSignup).toHaveBeenCalledWith("coexistence")
    expect(await screen.findByText(/finish in the facebook window/i)).toBeTruthy()
  })

  it("lands on the choice when a direct popup is closed", async () => {
    launchEmbeddedSignup.mockRejectedValueOnce(new EmbeddedSignupCancelledError(null))
    await renderButton({ mode: "new" })

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))

    expect(await screen.findByText(/closed before setup finished/i)).toBeTruthy()
    expect(screen.getByRole("radio", { name: /step-by-step setup/i })).toBeTruthy()
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

  // The welcome screen swaps itself for the dashboard on `onDone`; firing it
  // with the result still on screen would unmount the dialog unread.
  it("reports done only once the success screen is closed", async () => {
    const onDone = vi.fn()
    launchEmbeddedSignup.mockResolvedValueOnce({ code: "c" })
    const { submitEmbeddedSignup } = await import("@/services/api")
    const result = { accountId: "a", wabaId: "w", phoneNumberId: "p", status: "verified", registered: true }
    vi.mocked(submitEmbeddedSignup).mockResolvedValueOnce(result)
    await renderButton({ mode: "new", onDone })

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    expect(await screen.findByText(/whatsapp is connected/i)).toBeTruthy()
    expect(onDone).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /^done$/i }))
    expect(onDone).toHaveBeenCalledWith(result)
  })

  it("does not report done when the dialog is closed without connecting", async () => {
    const onDone = vi.fn()
    launchEmbeddedSignup.mockReturnValue(new Promise(() => {}))
    await renderButton({ mode: "new", onDone })

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    fireEvent.click(await screen.findByRole("button", { name: /^cancel$/i }))
    expect(onDone).not.toHaveBeenCalled()
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

  // Closing the dialog doesn't close Meta's window. Someone who finishes
  // there anyway has a WhatsApp account at Meta; dropping the code would leave
  // it connected nowhere.
  it("still connects a signup finished after the dialog was closed", async () => {
    const onSuccess = vi.fn()
    let finishPopup!: (v: { code: string }) => void
    launchEmbeddedSignup.mockReturnValueOnce(new Promise((resolve) => (finishPopup = resolve)))
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
    fireEvent.click(await screen.findByRole("button", { name: /^cancel$/i }))

    finishPopup({ code: "late" })
    await waitFor(() => expect(submitEmbeddedSignup).toHaveBeenCalledWith("late", expect.anything()))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it("returns to the choice, with a note, when the Facebook window is closed", async () => {
    launchEmbeddedSignup.mockRejectedValueOnce(new EmbeddedSignupCancelledError(null))
    await renderButton()

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    fireEvent.click(screen.getByRole("button", { name: /continue with facebook/i }))

    expect(await screen.findByText(/closed before setup finished/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: /continue with facebook/i })).toBeTruthy()
  })

  it("blocks the popup and offers to upgrade once the plan's number limit is reached", async () => {
    entitlementUsage.mockReturnValueOnce({
      data: {
        plan: "starter",
        trialEndsAt: null,
        limits: { numbers: 1, broadcastsPerMonth: null, activeDrips: null, chatbotJourneys: null, publishedFlows: null, api: false, aiDraftsPerMonth: null, aiCalling: false, support: "self_serve" },
        usage: { numbers: 1, broadcastsThisMonth: 0, activeDrips: 0, chatbotJourneys: 0, publishedFlows: 0, aiDraftsThisMonth: 0 },
      },
    })
    await renderButton()

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))

    expect(await screen.findByText(/reached your plan's number limit/i)).toBeTruthy()
    expect(screen.getByRole("link", { name: /view plans/i })).toHaveProperty(
      "href",
      expect.stringContaining("/dashboard/settings/plan")
    )
    expect(launchEmbeddedSignup).not.toHaveBeenCalled()
  })

  it("offers the guided setup as a fallback once the popup has been waiting a while", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      launchEmbeddedSignup.mockReturnValue(new Promise(() => {}))
      await renderButton()

      fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
      fireEvent.click(screen.getByRole("button", { name: /continue with facebook/i }))
      expect(await screen.findByText(/finish in the facebook window/i)).toBeTruthy()
      expect(screen.queryByRole("link", { name: /try the step-by-step setup/i })).toBeNull()

      await vi.advanceTimersByTimeAsync(45_000)

      const link = await screen.findByRole("link", { name: /try the step-by-step setup/i })
      expect(link).toHaveProperty("href", expect.stringContaining("/dashboard/whatsapp/new"))
    } finally {
      vi.useRealTimers()
    }
  })

  it("lets a Pro account past its base limit once the number add-on covers the gap", async () => {
    entitlementUsage.mockReturnValueOnce({
      data: {
        plan: "pro",
        trialEndsAt: null,
        limits: { numbers: 5, broadcastsPerMonth: null, activeDrips: null, chatbotJourneys: null, publishedFlows: null, api: true, aiDraftsPerMonth: null, aiCalling: true, support: "priority_dedicated" },
        usage: { numbers: 6, broadcastsThisMonth: 0, activeDrips: 0, chatbotJourneys: 0, publishedFlows: 0, aiDraftsThisMonth: 0 },
      },
    })
    numberAddon.mockReturnValueOnce({ data: { quantity: 2, billingPeriod: "monthly", status: "active", cancelAtCycleEnd: false, currentEnd: null, amountPerUnit: 999, currency: "INR" } })
    launchEmbeddedSignup.mockReturnValue(new Promise(() => {}))
    await renderButton({ askNumberType: false })

    fireEvent.click(screen.getByRole("button", { name: /connect whatsapp/i }))
    expect(launchEmbeddedSignup).toHaveBeenCalledWith("new")
  })
})
