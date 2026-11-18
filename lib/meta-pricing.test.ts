import { describe, expect, it } from "vitest"
import { META_RATES_INR } from "./savings"
import { formatInr, metaCostInr } from "./meta-pricing"

describe("metaCostInr", () => {
  it("prices the research report's worked example", () => {
    // 2,000 marketing + 5,000 utility = ₹1,726.20 + ₹575.00
    expect(metaCostInr({ marketing: 2000, utility: 5000 })).toEqual({ exGst: 2301.2, gst: 414.22, total: 2715.42 })
  })

  it("uses the shared rate table for every category", () => {
    const { exGst } = metaCostInr({ marketing: 1, utility: 1, authentication: 1 })
    expect(exGst).toBeCloseTo(META_RATES_INR.marketing + META_RATES_INR.utility + META_RATES_INR.authentication, 2)
  })

  it("costs nothing for no messages", () => {
    expect(metaCostInr({})).toEqual({ exGst: 0, gst: 0, total: 0 })
  })
})

describe("formatInr", () => {
  it("uses Indian digit grouping", () => {
    expect(formatInr(123456.5)).toBe("₹1,23,456.50")
  })

  it("keeps per-message precision", () => {
    expect(formatInr(0.8631)).toBe("₹0.8631")
    expect(formatInr(0.115)).toBe("₹0.115")
  })
})
