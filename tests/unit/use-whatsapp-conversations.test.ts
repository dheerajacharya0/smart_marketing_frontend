// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"

/**
 * A failed number lookup or list read only went to console.error, leaving
 * context null / conversations empty — read by the inbox as "No account
 * connected" / "No conversations yet". A failed filter change and the
 * reconnect refetch were unhandled rejections.
 */

const h = vi.hoisted(() => ({
  getActiveWhatsappContext: vi.fn(),
  getAvailableWhatsappContexts: vi.fn(),
  getChatConversations: vi.fn(),
  onReconnect: null as null | (() => void),
}))

vi.mock("@/services/api", () => ({
  getUserDataFromCookie: () => ({ id: "u1" }),
  getActiveWhatsappContext: h.getActiveWhatsappContext,
  getAvailableWhatsappContexts: h.getAvailableWhatsappContexts,
  getChatConversations: h.getChatConversations,
}))
vi.mock("@/hooks/use-active-number", () => ({ useActiveNumber: () => ({ switchNumber: vi.fn() }) }))
vi.mock("@/hooks/use-chat-socket", () => ({
  useChatSocket: (_a: unknown, _m: unknown, onReconnect: () => void) => {
    h.onReconnect = onReconnect
  },
}))

import { useWhatsappConversations } from "@/hooks/use-whatsapp-conversations"

const CTX = { accountId: "a1", wabaId: "w1", phoneNumberId: "p1" }
const row = (id: string) => ({
  id,
  wabaId: "w1",
  phoneNumberId: "p1",
  contactWaId: "919800000000",
  contactName: `Contact ${id}`,
  lastMessageAt: "2026-11-17T10:00:00Z",
  labels: [],
})

const unhandled: unknown[] = []
const onUnhandled = (e: unknown) => unhandled.push(e)

beforeEach(() => {
  h.getActiveWhatsappContext.mockReset().mockResolvedValue(CTX)
  h.getAvailableWhatsappContexts.mockReset().mockResolvedValue([CTX])
  h.getChatConversations.mockReset().mockResolvedValue([row("c1")])
  unhandled.length = 0
  process.on("unhandledRejection", onUnhandled)
})
afterEach(() => {
  cleanup()
  process.off("unhandledRejection", onUnhandled)
})

describe("useWhatsappConversations", () => {
  it("loads the list", async () => {
    const { result } = renderHook(() => useWhatsappConversations())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.conversations.map((c) => c.id)).toEqual(["c1"])
    expect(result.current.error).toBeNull()
  })

  it("a failed number lookup is an error, not 'no account'", async () => {
    h.getActiveWhatsappContext.mockRejectedValue(new Error("network down"))
    const { result } = renderHook(() => useWhatsappConversations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.context).toBeNull()
    expect(result.current.error).toBeTruthy()
  })

  it("no number at all is not an error", async () => {
    h.getActiveWhatsappContext.mockResolvedValue(null)
    const { result } = renderHook(() => useWhatsappConversations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.context).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it("a failed list read is an error, not 'no conversations'", async () => {
    h.getChatConversations.mockRejectedValue(new Error("network down"))
    const { result } = renderHook(() => useWhatsappConversations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeTruthy()
  })

  it("retry recovers", async () => {
    h.getChatConversations.mockRejectedValueOnce(new Error("network down"))
    const { result } = renderHook(() => useWhatsappConversations())
    await waitFor(() => expect(result.current.error).toBeTruthy())

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.conversations).toHaveLength(1))
    expect(result.current.error).toBeNull()
  })

  it("a failed filter change is an error, not an unhandled rejection", async () => {
    const { result } = renderHook(() => useWhatsappConversations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    h.getChatConversations.mockRejectedValueOnce(new Error("network down"))
    await act(async () => {
      result.current.setFilters({ unassigned: true })
      await new Promise((r) => setTimeout(r, 20))
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.loading).toBe(false)
    expect(unhandled).toEqual([])
  })

  it("two quick filter changes: the first one landing last doesn't win", async () => {
    const { result } = renderHook(() => useWhatsappConversations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let failFirst: (e: Error) => void = () => {}
    h.getChatConversations
      .mockReturnValueOnce(new Promise((_, rej) => (failFirst = rej)))
      .mockResolvedValueOnce([row("c2")])
    act(() => result.current.setFilters({ unassigned: true }))
    act(() => result.current.setFilters({ label: "vip" }))
    await waitFor(() => expect(result.current.conversations.map((c) => c.id)).toEqual(["c2"]))

    // The first filter's request now fails, late.
    await act(async () => {
      failFirst(new Error("network down"))
      await new Promise((r) => setTimeout(r, 20))
    })

    expect(result.current.error).toBeNull()
    expect(result.current.conversations.map((c) => c.id)).toEqual(["c2"])
    expect(result.current.loading).toBe(false)
  })

  it("a failed reconnect refetch keeps the list and raises nothing", async () => {
    const { result } = renderHook(() => useWhatsappConversations())
    await waitFor(() => expect(result.current.conversations).toHaveLength(1))

    h.getChatConversations.mockRejectedValueOnce(new Error("network down"))
    await act(async () => {
      h.onReconnect?.()
      await new Promise((r) => setTimeout(r, 20))
    })

    expect(result.current.conversations).toHaveLength(1)
    expect(result.current.error).toBeNull()
    expect(unhandled).toEqual([])
  })
})
