import { describe, expect, it } from "vitest"
import { compare, CONVERSZIO, COMPETITORS, formatInr, quote } from "./savings"

describe("quote", () => {
  it("prices messages at Meta's rate with no markup or plan for Converszio", () => {
    const q = quote(CONVERSZIO, 10_000, "marketing")
    expect(q.metaCost).toBeCloseTo(8631)
    expect(q.markupCost).toBe(0)
    expect(q.total).toBeCloseTo(8631)
  })

  it("adds plan and markup for a competitor", () => {
    const p = { id: "x", name: "X", plan: 2000, markup: 0.2, planLabel: "" }
    const q = quote(p, 1000, "utility")
    expect(q.metaCost).toBeCloseTo(115)
    expect(q.markupCost).toBeCloseTo(23)
    expect(q.total).toBeCloseTo(2138)
  })

  it("treats junk volumes as zero", () => {
    expect(quote(CONVERSZIO, -5, "marketing").total).toBe(0)
    expect(quote(CONVERSZIO, Number.NaN, "marketing").total).toBe(0)
  })
})

describe("compare", () => {
  it("sorts competitors cheapest first", () => {
    const { theirs } = compare(50_000, "marketing")
    const totals = theirs.map((q) => q.total)
    expect(totals).toEqual([...totals].sort((a, b) => a - b))
    expect(theirs).toHaveLength(COMPETITORS.length)
  })

  it("saves at least the cheapest plan even at zero messages", () => {
    const { maxSavings, avgSavings } = compare(0, "marketing")
    const plans = COMPETITORS.map((p) => p.plan)
    expect(maxSavings).toBe(Math.max(...plans))
    expect(avgSavings).toBeCloseTo(plans.reduce((a, b) => a + b, 0) / plans.length)
  })

  it("always undercuts every competitor", () => {
    const { ours, theirs } = compare(123_456, "authentication")
    for (const q of theirs) expect(q.total).toBeGreaterThan(ours.total)
  })
})

describe("formatInr", () => {
  it("uses Indian grouping and no paise", () => {
    expect(formatInr(123456.7)).toBe("₹1,23,457")
  })
})
