// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { confirmationMatches, disconnectConfirmation } from "./disconnect-number-dialog"

vi.mock("@/services/api", () => ({ disconnectWhatsappPhone: vi.fn() }))

afterEach(cleanup)

describe("disconnectConfirmation", () => {
  it("asks for the number's digits", () => {
    expect(disconnectConfirmation("+91 63535 72410")).toBe("916353572410")
  })

  it("falls back to a word when the number isn't known", () => {
    expect(disconnectConfirmation(null)).toBe("DISCONNECT")
    expect(disconnectConfirmation("—")).toBe("DISCONNECT")
  })
})

describe("confirmationMatches", () => {
  it("ignores spaces, dashes, brackets and a leading +", () => {
    expect(confirmationMatches("+91 63535-72410", "916353572410")).toBe(true)
    expect(confirmationMatches("disconnect", "DISCONNECT")).toBe(true)
  })

  it("rejects anything else", () => {
    expect(confirmationMatches("91635357241", "916353572410")).toBe(false)
    expect(confirmationMatches("", "DISCONNECT")).toBe(false)
  })
})

describe("DisconnectNumberDialog", () => {
  async function renderDialog() {
    const { DisconnectNumberDialog } = await import("./disconnect-number-dialog")
    const onDisconnected = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <DisconnectNumberDialog
        open
        onOpenChange={onOpenChange}
        accountId="acc-1"
        phoneNumberId="pn-1"
        label="+91 63535 72410"
        phoneNumber="+91 63535 72410"
        onDisconnected={onDisconnected}
      />
    )
    const { disconnectWhatsappPhone } = await import("@/services/api")
    return { onDisconnected, onOpenChange, disconnectWhatsappPhone: vi.mocked(disconnectWhatsappPhone) }
  }

  it("stays locked until the number is typed, then disconnects", async () => {
    const { onDisconnected, disconnectWhatsappPhone } = await renderDialog()
    disconnectWhatsappPhone.mockResolvedValueOnce({ phoneNumberId: "pn-1", status: "disconnected" })
    const button = screen.getByRole("button", { name: /disconnect number/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: "+91 63535 72410" } })
    expect(button.disabled).toBe(false)
    fireEvent.click(button)

    await waitFor(() => expect(onDisconnected).toHaveBeenCalled())
    expect(disconnectWhatsappPhone).toHaveBeenCalledWith("acc-1", "pn-1")
  })

  // The backend refuses while a campaign or drip would still send from it;
  // that reason has to be readable, not a vanished toast.
  it("shows why the backend refused", async () => {
    const { onDisconnected, disconnectWhatsappPhone } = await renderDialog()
    disconnectWhatsappPhone.mockRejectedValueOnce(new Error("This number still has 1 campaign"))
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: "916353572410" } })
    fireEvent.click(screen.getByRole("button", { name: /disconnect number/i }))

    expect(await screen.findByText(/still has 1 campaign/i)).toBeTruthy()
    expect(onDisconnected).not.toHaveBeenCalled()
  })
})
