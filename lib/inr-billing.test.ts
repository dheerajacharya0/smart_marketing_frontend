import { describe, expect, it } from "vitest"
import type { WabaMetaSpend } from "@/services/api"
import { isPastInrDeadline, wabasNotOnInr } from "./inr-billing"

const waba = (over: Partial<WabaMetaSpend>): WabaMetaSpend =>
  ({
    wabaId: "w1",
    currency: "USD",
    status: "ok",
    total: { cost: 0, volume: 0 },
    freeVolume: 0,
    byCategory: [],
    byNumber: [],
    daily: [],
    byCountry: [],
    ...over,
  }) as WabaMetaSpend

describe("wabasNotOnInr", () => {
  it("flags customer-billed accounts in another currency", () => {
    expect(wabasNotOnInr([waba({ currency: "USD" })]).map((w) => w.wabaId)).toEqual(["w1"])
  })

  it("leaves INR accounts alone, whatever the case", () => {
    expect(wabasNotOnInr([waba({ currency: "INR" }), waba({ currency: "inr" })])).toEqual([])
  })

  it("ignores partner-billed, errored and unknown-currency accounts", () => {
    expect(
      wabasNotOnInr([
        waba({ status: "cost_unavailable" }),
        waba({ status: "error" }),
        waba({ currency: null }),
      ]),
    ).toEqual([])
  })
})

describe("isPastInrDeadline", () => {
  it("switches after 31 Dec 2026 IST", () => {
    expect(isPastInrDeadline(new Date("2026-12-31T18:00:00Z"))).toBe(false)
    expect(isPastInrDeadline(new Date("2026-12-31T18:30:01Z"))).toBe(true)
  })
})
