import { describe, expect, it } from "vitest"
import { rowCost, rowDetail, rowTitles } from "./template-spend"
import type { TemplateSpend, WabaTemplateSpend } from "@/services/api"

const t = (o: Partial<TemplateSpend> = {}): TemplateSpend => ({
  templateId: "t1",
  name: "order_shipped_update",
  language: "en_US",
  category: "UTILITY",
  sent: 4,
  delivered: 4,
  read: 3,
  failed: 0,
  charged: 4,
  urlClicks: 0,
  quickReplyClicks: 0,
  amountSpent: 0.46,
  estimatedCost: 0.5428,
  costPerDelivered: 0.115,
  costPerUrlClick: null,
  ...o,
})

const waba = (o: Partial<WabaTemplateSpend> = {}): WabaTemplateSpend => ({
  wabaId: "w1",
  currency: "INR",
  estimateCurrency: "INR",
  status: "ok",
  templates: [],
  ...o,
})

const money = (n: number) => `₹${n.toFixed(2)}`

describe("rowCost", () => {
  it("prefers Meta's own figure when Meta's data is in", () => {
    expect(rowCost(t(), waba())).toEqual({ kind: "meta", amount: 0.46, currency: "INR" })
  })

  it("falls back to our estimate when Meta reports nothing for a charged send", () => {
    expect(rowCost(t({ amountSpent: 0 }), waba())).toEqual({ kind: "estimate", amount: 0.5428, currency: "INR" })
  })

  it("uses our estimate, in our currency, when Meta refused", () => {
    const cost = rowCost(t({ amountSpent: 0 }), waba({ status: "not_enabled", currency: null, estimateCurrency: "INR" }))
    expect(cost).toEqual({ kind: "estimate", amount: 0.5428, currency: "INR" })
  })

  it("never shows Meta's amount when Meta's status is an error", () => {
    expect(rowCost(t({ estimatedCost: null }), waba({ status: "error" }))).toEqual({ kind: "none" })
  })

  it("shows free when Meta's data is in and nothing was charged", () => {
    expect(rowCost(t({ amountSpent: 0, estimatedCost: null, charged: 0 }), waba())).toEqual({ kind: "free", currency: "INR" })
  })

  it("tolerates a pre-#140 response with no estimate fields", () => {
    const old = t({ amountSpent: 0 })
    delete old.estimatedCost
    delete old.charged
    expect(rowCost(old, waba({ status: "cost_unavailable" }))).toEqual({ kind: "none" })
  })
})

describe("rowDetail", () => {
  it("always shows sent and delivered, and per-delivered only beside Meta's cost", () => {
    const row = t()
    expect(rowDetail(row, rowCost(row, waba()), money)).toBe("Utility · 4 sent · 4 delivered · ₹0.12/delivered")
    const est = t({ amountSpent: 0 })
    expect(rowDetail(est, rowCost(est, waba()), money)).toBe("Utility · 4 sent · 4 delivered")
  })

  it("adds failed and clicks only when non-zero", () => {
    const row = t({ failed: 1, urlClicks: 2, quickReplyClicks: 1, costPerDelivered: null })
    expect(rowDetail(row, rowCost(row, waba()), money)).toBe("Utility · 4 sent · 4 delivered · 1 failed · 3 clicks")
    const one = t({ urlClicks: 1, costPerDelivered: null })
    expect(rowDetail(one, rowCost(one, waba()), money)).toMatch(/· 1 click$/)
  })

  it("labels a missing category", () => {
    const row = t({ category: null, costPerDelivered: null })
    expect(rowDetail(row, rowCost(row, waba()), money)).toMatch(/^Uncategorized · /)
  })
})

describe("rowTitles", () => {
  it("adds the language only where a name repeats", () => {
    const titles = rowTitles([
      t({ templateId: "a", name: "promo", language: "en_US" }),
      t({ templateId: "b", name: "promo", language: "hi" }),
      t({ templateId: "c", name: "receipt", language: "en_US" }),
    ])
    expect([...titles.values()]).toEqual(["promo (en_US)", "promo (hi)", "receipt"])
  })

  it("falls back to the id tail for a template we no longer have", () => {
    expect(rowTitles([t({ templateId: "1234567890", name: null })]).get("1234567890")).toBe("Template 567890")
  })
})
