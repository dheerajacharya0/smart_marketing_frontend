// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
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
  NUMBERS_CHANGED_EVENT: "whatsapp-numbers-changed",
  setActiveWhatsappPhoneNumberId: vi.fn(),
}))

import { useActiveNumber, useNumberEpoch } from "@/hooks/use-active-number"

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

  describe("pending", () => {
    it("is true while the lookup hasn't answered", () => {
      api.getActiveWhatsappContext.mockReturnValue(new Promise(() => {}))
      const { result } = setup()
      expect(result.current.pending).toBe(true)
    })

    it("is false once the lookup failed (an error, not still loading)", async () => {
      api.getActiveWhatsappContext.mockRejectedValue(new Error("network down"))
      const { result } = setup()
      await waitFor(() => expect(result.current.error).toBeTruthy())
      expect(result.current.pending).toBe(false)
    })

    it("is false once the lookup found no number", async () => {
      api.getActiveWhatsappContext.mockResolvedValue(null)
      const { result } = setup()
      await waitFor(() => expect(result.current.hasNoNumber).toBe(true))
      expect(result.current.pending).toBe(false)
    })

    it("is false once a number is found", async () => {
      api.getActiveWhatsappContext.mockResolvedValue(NUMBER)
      const { result } = setup()
      await waitFor(() => expect(result.current.active).toEqual(NUMBER))
      expect(result.current.pending).toBe(false)
    })
  })

  describe("when the set of numbers changes", () => {
    const OTHER = { accountId: "acc-1", wabaId: "waba-1", phoneNumberId: "pn-2" }

    // The layout's instance: the only one that listens.
    function setupLayout() {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children)
      return renderHook(
        () => ({ number: useActiveNumber({ followOtherTabs: true }), epoch: useNumberEpoch() }),
        { wrapper },
      )
    }

    it("moves to the fallback number, as a switch, when the active one was removed", async () => {
      api.getActiveWhatsappContext.mockResolvedValue(NUMBER)
      const { result } = setupLayout()
      await waitFor(() => expect(result.current.number.active).toEqual(NUMBER))
      const epochBefore = result.current.epoch

      // pn-1 disconnected; the lookup now falls back to pn-2.
      api.getActiveWhatsappContext.mockResolvedValue(OTHER)
      await act(async () => {
        window.dispatchEvent(new Event("whatsapp-numbers-changed"))
      })

      await waitFor(() => expect(result.current.number.active).toEqual(OTHER))
      expect(result.current.epoch).toBe(epochBefore + 1)
    })

    it("picks up a first number without re-mounting the page (mid-onboarding)", async () => {
      api.getActiveWhatsappContext.mockResolvedValue(null)
      const { result } = setupLayout()
      await waitFor(() => expect(result.current.number.hasNoNumber).toBe(true))
      const epochBefore = result.current.epoch

      api.getActiveWhatsappContext.mockResolvedValue(NUMBER)
      await act(async () => {
        window.dispatchEvent(new Event("whatsapp-numbers-changed"))
      })

      await waitFor(() => expect(result.current.number.active).toEqual(NUMBER))
      expect(result.current.epoch).toBe(epochBefore)
    })

    it("leaves the page alone when the active number is unchanged", async () => {
      api.getActiveWhatsappContext.mockResolvedValue(NUMBER)
      const { result } = setupLayout()
      await waitFor(() => expect(result.current.number.active).toEqual(NUMBER))
      const epochBefore = result.current.epoch

      await act(async () => {
        window.dispatchEvent(new Event("whatsapp-numbers-changed"))
      })

      await waitFor(() => expect(api.getActiveWhatsappContext).toHaveBeenCalledTimes(2))
      expect(result.current.epoch).toBe(epochBefore)
    })
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
