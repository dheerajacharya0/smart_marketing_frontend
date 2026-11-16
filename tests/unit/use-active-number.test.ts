// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"

/**
 * `useActiveNumber` decides whether a page may say "No registered WhatsApp
 * number yet". That copy sends people back through onboarding, so it must
 * only ever follow a lookup that succeeded and found nothing — never one that
 * failed, and never a cached "nothing" from before onboarding finished.
 */

const api = vi.hoisted(() => ({
  getActiveWhatsappContext: vi.fn(),
  getAvailableWhatsappContexts: vi.fn(),
}))

vi.mock("@/services/api", () => ({
  ACTIVE_PHONE_NUMBER_KEY: "activeWhatsappPhoneNumberId",
  getActiveWhatsappContext: api.getActiveWhatsappContext,
  getAvailableWhatsappContexts: api.getAvailableWhatsappContexts,
  getUserDataFromCookie: () => ({ id: "user-1" }),
  invalidateAccountCaches: vi.fn(),
  setActiveWhatsappPhoneNumberId: vi.fn(),
}))

import { useActiveNumber } from "@/hooks/use-active-number"

const NUMBER = { accountId: "acc-1", wabaId: "waba-1", phoneNumberId: "pn-1" }

function setup(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return { client, ...renderHook(() => useActiveNumber(), { wrapper }) }
}

beforeEach(() => {
  api.getActiveWhatsappContext.mockReset()
  api.getAvailableWhatsappContexts.mockReset().mockResolvedValue([])
})
afterEach(cleanup)

describe("useActiveNumber", () => {
  it("a failed lookup is an error, not 'no number'", async () => {
    api.getActiveWhatsappContext.mockRejectedValue(new Error("network down"))
    const { result } = setup()

    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.active).toBeNull()
    expect(result.current.hasNoNumber).toBe(false)
  })

  it("a successful empty lookup is 'no number'", async () => {
    api.getActiveWhatsappContext.mockResolvedValue(null)
    const { result } = setup()

    await waitFor(() => expect(result.current.hasNoNumber).toBe(true))
    expect(result.current.error).toBeNull()
  })

  it("is not 'no number' before the lookup has answered", () => {
    api.getActiveWhatsappContext.mockReturnValue(new Promise(() => {}))
    const { result } = setup()

    expect(result.current.hasNoNumber).toBe(false)
  })

  it("re-checks a cached 'no number' on the next mount instead of trusting it", async () => {
    api.getActiveWhatsappContext.mockResolvedValue(null)
    const first = setup()
    await waitFor(() => expect(first.result.current.hasNoNumber).toBe(true))
    first.unmount()

    // Onboarding finished in between; nothing invalidated the cache.
    api.getActiveWhatsappContext.mockResolvedValue(NUMBER)
    api.getAvailableWhatsappContexts.mockResolvedValue([NUMBER])
    const second = setup(first.client)

    // The stale null must not be shown as an answer while it's re-checked.
    expect(second.result.current.hasNoNumber).toBe(false)
    await waitFor(() => expect(second.result.current.active).toEqual(NUMBER))
  })

  it("keeps a found number cached across mounts", async () => {
    api.getActiveWhatsappContext.mockResolvedValue(NUMBER)
    const first = setup()
    await waitFor(() => expect(first.result.current.active).toEqual(NUMBER))
    first.unmount()

    setup(first.client)
    expect(api.getActiveWhatsappContext).toHaveBeenCalledTimes(1)
  })
})
