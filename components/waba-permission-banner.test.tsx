// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { WhatsappPhoneNumber } from "@/services/api"

vi.mock("@/hooks/use-account-id", () => ({
  useAccountId: () => ({ accountId: "account-1", resolved: true, error: null }),
}))

const phoneNumbers = vi.fn<() => { data: WhatsappPhoneNumber[] | undefined }>(() => ({ data: undefined }))
const partnerAccessStatus = vi.fn<() => { data: { granted: boolean } | undefined }>(() => ({ data: undefined }))
vi.mock("@/hooks/use-queries", () => ({
  useWhatsappPhoneNumbers: () => phoneNumbers(),
  usePartnerAccessStatus: () => partnerAccessStatus(),
}))

afterEach(() => {
  cleanup()
  phoneNumbers.mockReset()
  partnerAccessStatus.mockReset()
})

async function renderBanner() {
  const { WabaPermissionBanner } = await import("./waba-permission-banner")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <WabaPermissionBanner />
    </QueryClientProvider>
  )
}

describe("WabaPermissionBanner", () => {
  it("renders nothing when no number is recovered", async () => {
    phoneNumbers.mockReturnValue({ data: [{ id: "1", wabaId: "w", phoneNumberId: "p", status: "registered" }] })
    partnerAccessStatus.mockReturnValue({ data: undefined })
    await renderBanner()
    expect(screen.queryByText(/needs one more permission/i)).toBeNull()
  })

  it("renders nothing while the live status hasn't loaded yet, even with a recovered number", async () => {
    phoneNumbers.mockReturnValue({
      data: [{ id: "1", wabaId: "w", phoneNumberId: "p", status: "registered", usesSystemToken: true }],
    })
    partnerAccessStatus.mockReturnValue({ data: undefined })
    await renderBanner()
    expect(screen.queryByText(/needs one more permission/i)).toBeNull()
  })

  it("renders nothing once access has actually been granted", async () => {
    phoneNumbers.mockReturnValue({
      data: [{ id: "1", wabaId: "w", phoneNumberId: "p", status: "registered", usesSystemToken: true }],
    })
    partnerAccessStatus.mockReturnValue({ data: { granted: true } })
    await renderBanner()
    expect(screen.queryByText(/needs one more permission/i)).toBeNull()
  })

  it("shows the banner for a recovered number whose access isn't granted yet", async () => {
    phoneNumbers.mockReturnValue({
      data: [{ id: "1", wabaId: "w", phoneNumberId: "p", status: "registered", usesSystemToken: true }],
    })
    partnerAccessStatus.mockReturnValue({ data: { granted: false } })
    await renderBanner()
    expect(await screen.findByText(/needs one more permission/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: /fix now/i })).toBeTruthy()
  })
})
