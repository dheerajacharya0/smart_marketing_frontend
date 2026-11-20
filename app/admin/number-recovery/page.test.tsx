// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

/**
 * The admin links a number by hand only after reading what the customer's own
 * Facebook connection says about it. A coexistence number never asks for a PIN.
 */

const api = vi.hoisted(() => ({
  getAdminOrphanedWhatsappAccounts: vi.fn(),
  getAdminOrphanedWabaPhoneNumbers: vi.fn(),
  getAdminRecoveryEvidence: vi.fn(),
  adminConfirmNumberRecovery: vi.fn(),
}))

vi.mock("@/services/api", () => api)
vi.mock("@/lib/errors", () => ({
  getErrorMessage: (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback),
}))

import AdminNumberRecoveryPage from "./page"

const ACCOUNT = "11111111-1111-4111-8111-111111111111"

async function pickNumber(number: Record<string, unknown>) {
  api.getAdminOrphanedWhatsappAccounts.mockResolvedValue({
    checked: 1,
    orphaned: [{ id: "100000000000001", name: "Example Business" }],
  })
  api.getAdminOrphanedWabaPhoneNumbers.mockResolvedValue([
    { id: "200000000000002", display_phone_number: "+1 555-010-0199", ...number },
  ])
  render(<AdminNumberRecoveryPage />)
  fireEvent.click(screen.getByRole("button", { name: /load/i }))
  fireEvent.click(await screen.findByRole("button", { name: "View numbers" }))
  fireEvent.click(await screen.findByRole("button", { name: "Select" }))
}

function enterAccount(id = ACCOUNT) {
  fireEvent.change(screen.getByLabelText("Target account id"), { target: { value: id } })
}

describe("admin number recovery — ownership evidence", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it("only checks once a full account id is entered", async () => {
    await pickNumber({ platform_type: "CLOUD_API" })
    const check = screen.getByRole("button", { name: /check ownership/i })
    expect((check as HTMLButtonElement).disabled).toBe(true)
    enterAccount("11111111")
    expect((check as HTMLButtonElement).disabled).toBe(true)
    enterAccount()
    expect((check as HTMLButtonElement).disabled).toBe(false)
  })

  it("says Facebook confirms ownership when the token was granted the WABA", async () => {
    api.getAdminRecoveryEvidence.mockResolvedValue({
      facebookConnected: true,
      tokenGrant: "granted",
      businessListing: "unavailable",
    })
    await pickNumber({ platform_type: "CLOUD_API" })
    enterAccount()
    fireEvent.click(screen.getByRole("button", { name: /check ownership/i }))
    expect(await screen.findByText(/Facebook confirms this customer manages/)).toBeTruthy()
    expect(api.getAdminRecoveryEvidence).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      wabaId: "100000000000001",
      phoneNumberId: "200000000000002",
    })
  })

  it("warns when the customer's Facebook connection does not include the WABA", async () => {
    api.getAdminRecoveryEvidence.mockResolvedValue({
      facebookConnected: true,
      tokenGrant: "not_granted",
      businessListing: "unavailable",
    })
    await pickNumber({ platform_type: "CLOUD_API" })
    enterAccount()
    fireEvent.click(screen.getByRole("button", { name: /check ownership/i }))
    expect(await screen.findByText(/does not include this WhatsApp account/)).toBeTruthy()
  })

  it("says it couldn't confirm when nothing could be checked", async () => {
    api.getAdminRecoveryEvidence.mockResolvedValue({
      facebookConnected: false,
      tokenGrant: "unavailable",
      businessListing: "unavailable",
    })
    await pickNumber({ platform_type: "CLOUD_API" })
    enterAccount()
    fireEvent.click(screen.getByRole("button", { name: /check ownership/i }))
    expect(await screen.findByText(/couldn't confirm either way/)).toBeTruthy()
  })

  it("clears the result when the account id changes", async () => {
    api.getAdminRecoveryEvidence.mockResolvedValue({
      facebookConnected: true,
      tokenGrant: "granted",
      businessListing: "listed",
    })
    await pickNumber({ platform_type: "CLOUD_API" })
    enterAccount()
    fireEvent.click(screen.getByRole("button", { name: /check ownership/i }))
    await screen.findByText(/Facebook confirms/)
    enterAccount("22222222-2222-4222-8222-222222222222")
    expect(screen.queryByText(/Facebook confirms/)).toBeNull()
  })

  it("drops a slow result for the previous account id", async () => {
    let resolveOld: (v: unknown) => void = () => {}
    api.getAdminRecoveryEvidence.mockReturnValueOnce(new Promise((r) => (resolveOld = r)))
    await pickNumber({ platform_type: "CLOUD_API" })
    enterAccount()
    fireEvent.click(screen.getByRole("button", { name: /check ownership/i }))
    enterAccount("22222222-2222-4222-8222-222222222222")
    await act(async () => {
      resolveOld({ facebookConnected: true, tokenGrant: "granted", businessListing: "listed" })
    })
    expect(screen.queryByText(/Facebook confirms/)).toBeNull()
    // And the button is usable again for the new id.
    const check = screen.getByRole("button", { name: /check ownership/i }) as HTMLButtonElement
    expect(check.disabled).toBe(false)
  })

  it("shows the error when the check fails", async () => {
    api.getAdminRecoveryEvidence.mockRejectedValue(new Error("Account not found"))
    await pickNumber({ platform_type: "CLOUD_API" })
    enterAccount()
    fireEvent.click(screen.getByRole("button", { name: /check ownership/i }))
    expect(await screen.findByText("Account not found")).toBeTruthy()
  })
})

describe("admin number recovery — PIN", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it("asks for a PIN for a number not on the Cloud API", async () => {
    await pickNumber({ platform_type: "NOT_APPLICABLE" })
    expect(screen.queryByLabelText(/6-digit PIN/)).toBeTruthy()
  })

  it("never asks for a PIN for a number on the WhatsApp Business app", async () => {
    await pickNumber({ platform_type: "NOT_APPLICABLE", is_on_biz_app: true })
    expect(screen.queryByLabelText(/6-digit PIN/)).toBeNull()
  })
})
