// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import type { WabaMetaSpend } from "@/services/api"

/**
 * The INR billing notice inside the Meta charges card: who sees it, who must
 * not, and that it never pushes the spend figures out of the card.
 */

const spendState: { data: { wabas: WabaMetaSpend[] } | undefined; isLoading: boolean; error: unknown } = {
  data: undefined,
  isLoading: false,
  error: null,
}
let numbers: Array<{ wabaId: string; phoneNumberId: string; displayPhoneNumber?: string; verifiedName?: string }> = []

vi.mock("@/hooks/use-queries", () => ({
  useMetaSpend: () => ({ ...spendState, refetch: vi.fn() }),
}))
vi.mock("@/hooks/use-active-number", () => ({
  useActiveNumber: () => ({ numbers }),
}))

import { MetaSpendCard } from "./meta-spend-card"

const waba = (over: Partial<WabaMetaSpend>): WabaMetaSpend => ({
  wabaId: "1000000000001234",
  currency: "USD",
  status: "ok",
  total: { cost: 12.5, volume: 100 },
  freeVolume: 0,
  byCategory: [{ category: "marketing", cost: 12.5, volume: 100 }],
  byNumber: [],
  daily: [],
  byCountry: [],
  ...over,
})

const renderCard = (wabas: WabaMetaSpend[]) => {
  spendState.data = { wabas }
  return render(<MetaSpendCard accountId="acc" from={new Date("2026-11-01")} to={new Date("2026-11-19")} />)
}

const notice = () => screen.queryByText(/Move your Meta billing to INR|no longer delivers messages from non-INR/)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-19T10:00:00Z"))
  numbers = []
  spendState.isLoading = false
  spendState.error = null
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("MetaSpendCard INR billing notice", () => {
  it("warns for a customer-billed USD account, naming it by its number", () => {
    numbers = [{ wabaId: "1000000000001234", phoneNumberId: "p1", displayPhoneNumber: "+91 98765 43210", verifiedName: "Smile Dental" }]
    renderCard([waba({})])
    expect(notice()).not.toBeNull()
    expect(screen.getByText(/\+91 98765 43210 · Smile Dental \(USD\) is billed/)).toBeTruthy()
    // The spend itself still renders under the notice.
    expect(screen.getByText("Marketing")).toBeTruthy()
  })

  it("falls back to the account id tail when no number is known", () => {
    renderCard([waba({})])
    expect(screen.getByText(/WhatsApp account ending 1234 \(USD\) is billed/)).toBeTruthy()
  })

  it("stays silent for INR, partner-billed, errored and unknown-currency accounts", () => {
    renderCard([
      waba({ wabaId: "a", currency: "INR" }),
      waba({ wabaId: "b", status: "cost_unavailable" }),
      waba({ wabaId: "c", status: "error", error: "Couldn't load", currency: null }),
      waba({ wabaId: "d", currency: null }),
    ])
    expect(notice()).toBeNull()
  })

  it("lists every affected account once, pluralised", () => {
    renderCard([waba({ wabaId: "x1111" }), waba({ wabaId: "y2222", currency: "EUR" }), waba({ wabaId: "z3333", currency: "INR" })])
    expect(screen.getAllByText(/Move your Meta billing to INR/)).toHaveLength(1)
    expect(screen.getByText(/ending 1111 \(USD\), WhatsApp account ending 2222 \(EUR\) are billed/)).toBeTruthy()
  })

  it("warns even when the account had no messages in the range", () => {
    renderCard([waba({ total: { cost: 0, volume: 0 }, byCategory: [] })])
    expect(notice()).not.toBeNull()
  })

  it("switches to past tense after the deadline", () => {
    vi.setSystemTime(new Date("2027-01-02T00:00:00Z"))
    renderCard([waba({})])
    expect(screen.getByText(/Meta no longer delivers messages from non-INR accounts/)).toBeTruthy()
    expect(screen.queryByText(/by 31 Dec 2026/)).toBeNull()
  })

  it("shows nothing while loading or on a load error", () => {
    spendState.isLoading = true
    renderCard([waba({})])
    expect(notice()).toBeNull()
    cleanup()
    spendState.isLoading = false
    spendState.error = new Error("boom")
    renderCard([waba({})])
    expect(notice()).toBeNull()
  })
})
