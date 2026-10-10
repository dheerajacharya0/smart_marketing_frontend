import { describe, expect, it } from "vitest"
import { compare, CONVERSZIO, COMPETITORS, formatInr, quote } from "./savings"

describe("quote", () => {
  it("prices messages at Meta's rate plus the Starter plan, no markup", () => {
    const q = quote(CONVERSZIO, 10_000, "marketing")
    expect(q.metaCost).toBeCloseTo(8631)
    expect(q.markupCost).toBe(0)
    expect(q.total).toBeCloseTo(8631 + CONVERSZIO.plan)
  })

  it("adds plan and markup for a competitor", () => {
    const p = { id: "x", name: "X", plan: 2000, markup: 0.2, planLabel: "" }
    const q = quote(p, 1000, "utility")
    expect(q.metaCost).toBeCloseTo(115)
    expect(q.markupCost).toBeCloseTo(23)
    expect(q.total).toBeCloseTo(2138)
  })

  it("treats junk volumes as zero messages, plan still applies", () => {
    expect(quote(CONVERSZIO, -5, "marketing").total).toBe(CONVERSZIO.plan)
    expect(quote(CONVERSZIO, Number.NaN, "marketing").total).toBe(CONVERSZIO.plan)
  })
})

describe("compare", () => {
  it("sorts competitors cheapest first", () => {
    const { theirs } = compare(50_000, "marketing")
    const totals = theirs.map((q) => q.total)
    expect(totals).toEqual([...totals].sort((a, b) => a - b))
    expect(theirs).toHaveLength(COMPETITORS.length)
  })

  it("still shows savings at zero messages, since competitor plans cost more than Starter", () => {
    const { ours, maxSavings, avgSavings } = compare(0, "marketing")
    expect(ours.total).toBe(CONVERSZIO.plan)
    const plans = COMPETITORS.map((p) => p.plan)
    expect(maxSavings).toBeCloseTo(Math.max(...plans) - CONVERSZIO.plan)
    expect(avgSavings).toBeCloseTo(plans.reduce((a, b) => a + b, 0) / plans.length - CONVERSZIO.plan)
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
