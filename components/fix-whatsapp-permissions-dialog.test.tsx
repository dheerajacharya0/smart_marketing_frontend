// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FixWhatsAppPermissionsDialog } from "./fix-whatsapp-permissions-dialog"

const getPartnerAccessStatus = vi.fn()
vi.mock("@/services/api", () => ({
  getPartnerAccessStatus: (...args: unknown[]) => getPartnerAccessStatus(...args),
}))

afterEach(() => {
  cleanup()
  getPartnerAccessStatus.mockReset()
})

describe("FixWhatsAppPermissionsDialog", () => {
  it("shows the manual grant steps with the copyable portfolio ID when access hasn't been granted yet", async () => {
    getPartnerAccessStatus.mockResolvedValue({
      portfolioId: "123456",
      wabaId: "waba-1",
      granted: false,
      tasks: ["MANAGE_TEMPLATES"],
    })
    render(<FixWhatsAppPermissionsDialog open onOpenChange={() => {}} accountId="account-1" />)

    expect(await screen.findByText("123456")).toBeTruthy()
    expect(screen.getByRole("button", { name: /check again/i })).toBeTruthy()
    expect(getPartnerAccessStatus).toHaveBeenCalledWith("account-1")
  })

  it("shows a success state once access is granted, with no more manual steps", async () => {
    getPartnerAccessStatus.mockResolvedValue({
      portfolioId: "123456",
      wabaId: "waba-1",
      granted: true,
      tasks: ["MANAGE"],
    })
    render(<FixWhatsAppPermissionsDialog open onOpenChange={() => {}} accountId="account-1" />)

    expect(await screen.findByText(/full access granted/i)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /check again/i })).toBeNull()
  })

  it("re-checks status when the viewer clicks Check again", async () => {
    getPartnerAccessStatus.mockResolvedValue({
      portfolioId: "123456",
      wabaId: "waba-1",
      granted: false,
      tasks: [],
    })
    render(<FixWhatsAppPermissionsDialog open onOpenChange={() => {}} accountId="account-1" />)
    await screen.findByText("123456")

    fireEvent.click(screen.getByRole("button", { name: /check again/i }))
    await waitFor(() => expect(getPartnerAccessStatus).toHaveBeenCalledTimes(2))
  })
})
