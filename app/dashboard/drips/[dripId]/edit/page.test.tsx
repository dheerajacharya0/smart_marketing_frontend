// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

/**
 * This page used to print "Sequence not found." for every failure — a dropped
 * request, a failed number lookup — telling someone their sequence was gone.
 * Only a 404 (or an invalid id) may say that now.
 */

const state = vi.hoisted(() => ({
  number: {
    active: null as null | { accountId: string; wabaId: string; phoneNumberId: string },
    error: null as unknown,
    hasNoNumber: false,
    retry: () => Promise.resolve(),
  },
  getDrip: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useParams: () => ({ dripId: "d1" }) }))
vi.mock("@/hooks/use-active-number", () => ({ useActiveNumber: () => state.number }))
vi.mock("@/services/api", async () => {
  class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message)
    }
  }
  return { ApiError, getDrip: state.getDrip }
})
vi.mock("@/lib/errors", async () => {
  const { ApiError } = await import("@/services/api")
  return { getErrorStatus: (e: unknown) => (e instanceof ApiError ? (e as { status: number }).status : undefined) }
})
vi.mock("../../drip-builder", () => ({ DripBuilder: () => <p>builder</p> }))
vi.mock("@/components/broadcast-loader", () => ({ BroadcastLoader: () => <p>loading</p> }))

import { ApiError } from "@/services/api"
import EditDripPage from "./page"

const NUMBER = { accountId: "acc-1", wabaId: "w1", phoneNumberId: "p1" }

beforeEach(() => {
  state.number = { active: NUMBER, error: null, hasNoNumber: false, retry: () => Promise.resolve() }
  state.getDrip.mockReset()
})
afterEach(cleanup)

describe("EditDripPage", () => {
  it("opens the builder when the sequence loads", async () => {
    state.getDrip.mockResolvedValue({ id: "d1" })
    render(<EditDripPage />)
    expect(await screen.findByText("builder")).toBeTruthy()
  })

  it("says not found only on a 404", async () => {
    state.getDrip.mockRejectedValue(new (ApiError as unknown as new (m: string, s: number) => Error)("gone", 404))
    render(<EditDripPage />)
    expect(await screen.findByText("Sequence not found.")).toBeTruthy()
  })

  it("says it couldn't load on any other failure, with a retry", async () => {
    state.getDrip.mockRejectedValue(new Error("network down"))
    render(<EditDripPage />)
    expect(await screen.findByText(/Couldn't load this sequence/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy()
    expect(screen.queryByText("Sequence not found.")).toBeNull()
  })

  it("says the number couldn't load when the lookup failed", () => {
    state.number = { active: null, error: new Error("network down"), hasNoNumber: false, retry: () => Promise.resolve() }
    render(<EditDripPage />)
    expect(screen.getByText("Couldn't load your WhatsApp number.")).toBeTruthy()
    expect(screen.queryByText("Sequence not found.")).toBeNull()
    expect(state.getDrip).not.toHaveBeenCalled()
  })

  it("shows a spinner, not 'not found', while the number is still loading", () => {
    state.number = { active: null, error: null, hasNoNumber: false, retry: () => Promise.resolve() }
    render(<EditDripPage />)
    expect(screen.getByText("loading")).toBeTruthy()
    expect(screen.queryByText("Sequence not found.")).toBeNull()
  })
})
