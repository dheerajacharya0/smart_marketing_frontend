// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"

/**
 * The thread's first load had no catch: a failure was an unhandled rejection
 * and the thread read "No messages yet". The refresh after a send, "load
 * older" and the reconnect merge were unhandled too.
 */

const h = vi.hoisted(() => ({
  getChatMessages: vi.fn(),
  toastError: vi.fn(),
  onReconnect: null as null | (() => void),
}))

vi.mock("@/services/api", () => ({
  getChatMessages: h.getChatMessages,
  markChatConversationRead: vi.fn(() => Promise.resolve(null)),
}))
vi.mock("@/hooks/use-whatsapp-conversations", () => ({
  publishConversationUpdate: vi.fn(),
  setOpenConversation: vi.fn(),
}))
vi.mock("@/hooks/use-chat-socket", () => ({
  useChatSocket: (_a: unknown, _m: unknown, onReconnect: () => void) => {
    h.onReconnect = onReconnect
  },
}))
vi.mock("react-hot-toast", () => ({ toast: { error: h.toastError, success: vi.fn() } }))

import { useChatMessages } from "@/hooks/use-chat-messages"

const event = (id: string, text: string, at = "2026-11-17T10:00:00Z") => ({
  id,
  direction: "inbound",
  type: "text",
  text,
  payload: { text: { body: text } },
  receivedAt: at,
})

function setup(initial: { conversationId: string | null; accountId: string | null }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return renderHook((p: { conversationId: string | null; accountId: string | null }) =>
    useChatMessages(p.conversationId, p.accountId), { wrapper, initialProps: initial })
}

const unhandled: unknown[] = []
const onUnhandled = (e: PromiseRejectionEvent | unknown) => unhandled.push(e)

beforeEach(() => {
  h.getChatMessages.mockReset()
  h.toastError.mockReset()
  unhandled.length = 0
  process.on("unhandledRejection", onUnhandled)
})
afterEach(() => {
  cleanup()
  process.off("unhandledRejection", onUnhandled)
})

describe("useChatMessages", () => {
  it("a failed first load is an error, not an empty thread", async () => {
    h.getChatMessages.mockRejectedValue(new Error("network down"))
    const { result } = setup({ conversationId: "c1", accountId: "a1" })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
    expect(result.current.messages).toEqual([])
    expect(unhandled).toEqual([])
  })

  it("retry loads the thread and clears the error", async () => {
    h.getChatMessages.mockRejectedValueOnce(new Error("network down")).mockResolvedValue([event("m1", "hi")])
    const { result } = setup({ conversationId: "c1", accountId: "a1" })
    await waitFor(() => expect(result.current.error).toBeTruthy())

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.messages).toHaveLength(1))
    expect(result.current.error).toBeNull()
  })

  it("a failed refresh after a send keeps the thread, unhandled no more", async () => {
    h.getChatMessages.mockResolvedValueOnce([event("m1", "hi")])
    const { result } = setup({ conversationId: "c1", accountId: "a1" })
    await waitFor(() => expect(result.current.messages).toHaveLength(1))

    h.getChatMessages.mockRejectedValueOnce(new Error("network down"))
    await act(async () => {
      result.current.refetch()
      await new Promise((r) => setTimeout(r, 20))
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.error).toBeNull()
    expect(unhandled).toEqual([])
  })

  it("a failed 'load older' toasts and keeps the thread", async () => {
    h.getChatMessages.mockResolvedValueOnce(Array.from({ length: 50 }, (_, i) => event(`m${i}`, `msg ${i}`)))
    const { result } = setup({ conversationId: "c1", accountId: "a1" })
    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0))
    const before = result.current.messages.length

    h.getChatMessages.mockRejectedValueOnce(new Error("network down"))
    await act(async () => {
      await result.current.loadOlder()
    })

    expect(h.toastError).toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(before)
  })

  it("switching thread drops the old messages, even if the new load fails", async () => {
    h.getChatMessages.mockResolvedValueOnce([event("m1", "hi from c1")])
    const { result, rerender } = setup({ conversationId: "c1", accountId: "a1" })
    await waitFor(() => expect(result.current.messages).toHaveLength(1))

    h.getChatMessages.mockRejectedValueOnce(new Error("network down"))
    rerender({ conversationId: "c2", accountId: "a1" })

    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.messages).toEqual([])
  })

  it("an older thread's answer landing after a switch is ignored", async () => {
    let resolveOld: (v: unknown) => void = () => {}
    h.getChatMessages.mockReturnValueOnce(new Promise((r) => (resolveOld = r)))
    const { result, rerender } = setup({ conversationId: "c1", accountId: "a1" })

    h.getChatMessages.mockResolvedValueOnce([event("m2", "hi from c2")])
    rerender({ conversationId: "c2", accountId: "a1" })
    await waitFor(() => expect(result.current.messages).toHaveLength(1))

    await act(async () => resolveOld([event("m1", "hi from c1")]))
    expect(result.current.messages.map((m) => m.id)).toEqual(["m2"])
  })

  it("a reconnect after a failed first load tries the load again", async () => {
    h.getChatMessages.mockRejectedValueOnce(new Error("network down")).mockResolvedValue([event("m1", "hi")])
    const { result } = setup({ conversationId: "c1", accountId: "a1" })
    await waitFor(() => expect(result.current.error).toBeTruthy())

    act(() => h.onReconnect?.())
    await waitFor(() => expect(result.current.messages).toHaveLength(1))
    expect(result.current.error).toBeNull()
  })
})
