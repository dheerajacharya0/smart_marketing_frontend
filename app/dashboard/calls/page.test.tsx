// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * Only a 403 used to be told apart: every other failure, and the moment before
 * the account resolved, rendered "No calls yet".
 */

const state = vi.hoisted(() => ({
  account: { accountId: "a1" as string | null, resolved: true, error: null as unknown, retry: () => Promise.resolve() },
  listCalls: vi.fn(),
}))

vi.mock("@/hooks/use-account-id", () => ({ useAccountId: () => state.account }))
vi.mock("@/hooks/use-active-number", () => ({ useActiveNumber: () => ({ active: null }) }))
vi.mock("@/hooks/use-chat-socket", () => ({ useChatSocket: () => {} }))
vi.mock("@/hooks/use-missed-calls", () => ({ missedCallsKey: (a: string) => ["missed-calls", a], useMarkCallsSeen: () => () => {} }))
vi.mock("@/components/calls/call-button", () => ({ CallButton: () => null }))
vi.mock("@/services/api", async () => {
  class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message)
    }
  }
  return { ApiError, listCalls: state.listCalls }
})
vi.mock("@/lib/errors", async () => {
  const { ApiError } = await import("@/services/api")
  return { getErrorStatus: (e: unknown) => (e instanceof ApiError ? (e as { status: number }).status : undefined) }
})

import { ApiError } from "@/services/api"
import CallsPage from "./page"

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CallsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  state.account = { accountId: "a1", resolved: true, error: null, retry: () => Promise.resolve() }
  state.listCalls.mockReset()
})
afterEach(cleanup)

describe("CallsPage", () => {
  it("says it couldn't load on a non-403 failure, not 'No calls yet'", async () => {
    state.listCalls.mockRejectedValue(new Error("network down"))
    renderPage()

    expect(await screen.findByText("Couldn't load your calls.")).toBeTruthy()
    expect(screen.queryByText("No calls yet")).toBeNull()
  })

  it("retries into the list", async () => {
    state.listCalls.mockRejectedValue(new Error("network down"))
    renderPage()
    const retry = await screen.findByRole("button", { name: "Try again" })

    state.listCalls.mockResolvedValue({ items: [], total: 0 })
    fireEvent.click(retry)
    expect(await screen.findByText("No calls yet")).toBeTruthy()
  })

  it("keeps the 403 message for teammates without access", async () => {
    state.listCalls.mockRejectedValue(new (ApiError as unknown as new (m: string, s: number) => Error)("no", 403))
    renderPage()

    expect(await screen.findByText("Calls aren't available to you")).toBeTruthy()
  })

  it("doesn't say 'No calls yet' before the account is known", () => {
    state.account = { accountId: null, resolved: false, error: null, retry: () => Promise.resolve() }
    renderPage()

    expect(screen.queryByText("No calls yet")).toBeNull()
  })

  it("says the account couldn't load when that lookup failed", () => {
    state.account = { accountId: null, resolved: true, error: new Error("network down"), retry: () => Promise.resolve() }
    renderPage()

    expect(screen.getByText(/Couldn't load your account/)).toBeTruthy()
    expect(screen.queryByText("No calls yet")).toBeNull()
  })

  describe("with calls already on screen", () => {
    const call = (i: number) => ({
      id: `call-${i}`,
      direction: "inbound",
      status: "ended",
      durationSeconds: 30,
      customerName: `Caller ${i}`,
      customerWaId: `91980000000${i}`,
      phoneNumberId: "p1",
      conversationId: null,
      createdAt: "2026-11-17T10:00:00Z",
    })

    it("a failed tab switch shows the error, not the previous tab's calls", async () => {
      state.listCalls.mockResolvedValueOnce({ items: [call(1)], total: 1 })
      renderPage()
      await screen.findByText("Caller 1")

      state.listCalls.mockRejectedValue(new Error("network down"))
      const missed = screen.getByRole("tab", { name: "Missed" })
      fireEvent.mouseDown(missed)
      fireEvent.click(missed)

      expect(await screen.findByText("Couldn't load your calls.")).toBeTruthy()
      expect(screen.queryByText("Caller 1")).toBeNull()
    })

    it("a failed 'Show more' says so instead of 'No calls yet'", async () => {
      state.listCalls.mockResolvedValueOnce({ items: [call(1)], total: 40 })
      renderPage()
      await screen.findByText("Caller 1")

      state.listCalls.mockRejectedValue(new Error("network down"))
      fireEvent.click(screen.getByRole("button", { name: "Show more" }))

      expect(await screen.findByText("Couldn't load your calls.")).toBeTruthy()
      expect(screen.queryByText("No calls yet")).toBeNull()
    })
  })

  it("still says 'No calls yet' for an account with none", async () => {
    state.listCalls.mockResolvedValue({ items: [], total: 0 })
    renderPage()

    expect(await screen.findByText("No calls yet")).toBeTruthy()
  })
})
