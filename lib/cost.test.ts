import { describe, expect, it } from "vitest"
import {
  combineEstimates,
  distinctTemplates,
  expandByOccurrences,
  sumMicros,
} from "./cost"
import type { CampaignCostEstimate } from "@/services/api"

function estimate(overrides: Partial<CampaignCostEstimate> = {}): CampaignCostEstimate {
  return {
    currency: "INR",
    recipientCount: 100,
    totalMicros: "89000000",
    category: "marketing",
    categoryAssumed: false,
    byCountry: [{ country: "IN", count: 100, unitMicros: "890000", subtotalMicros: "89000000" }],
    walletBalanceMicros: "500000000",
    sufficientBalance: true,
    basis: "upper bound",
    ...overrides,
  }
}

describe("sumMicros", () => {
  it("adds beyond Number's safe range", () => {
    // Two totals that are each fine as a Number but round once added as one.
    expect(sumMicros(["9007199254740991", "9007199254740991"])).toBe("18014398509481982")
  })

  it("skips missing and malformed figures instead of throwing", () => {
    expect(sumMicros(["1000000", null, undefined, "", "not-micros", "500000"])).toBe("1500000")
  })

  it("is zero for nothing", () => {
    expect(sumMicros([])).toBe("0")
  })
})

describe("combineEstimates", () => {
  it("returns null for an empty list rather than a zero price", () => {
    // A zero would render as "up to ₹0.00" — which reads as "this send is free"
    // rather than "we have not priced this".
    expect(combineEstimates([])).toBeNull()
  })

  it("sums money but takes the largest audience", () => {
    const combined = combineEstimates([
      estimate({ totalMicros: "89000000", recipientCount: 100 }),
      estimate({ totalMicros: "45000000", recipientCount: 100 }),
      estimate({ totalMicros: "45000000", recipientCount: 98 }),
    ])!

    expect(combined.totalMicros).toBe("179000000")
    // Three messages to the same 100 people is 100 people, not 298.
    expect(combined.recipientCount).toBe(100)
    expect(combined.messageCount).toBe(3)
  })

  it("merges country rows, summing spend and keeping one head count", () => {
    const combined = combineEstimates([
      estimate({
        byCountry: [
          { country: "IN", count: 80, unitMicros: "890000", subtotalMicros: "71200000" },
          { country: "AE", count: 20, unitMicros: "3400000", subtotalMicros: "68000000" },
        ],
      }),
      estimate({
        byCountry: [{ country: "IN", count: 80, unitMicros: "440000", subtotalMicros: "35200000" }],
      }),
    ])!

    expect(combined.byCountry).toEqual([
      { country: "IN", count: 80, subtotalMicros: "106400000" },
      { country: "AE", count: 20, subtotalMicros: "68000000" },
    ])
  })

  it("collects every category and flags an assumed one", () => {
    const combined = combineEstimates([
      estimate({ category: "marketing" }),
      estimate({ category: "utility", categoryAssumed: true }),
      estimate({ category: "marketing" }),
    ])!

    expect(combined.categories).toEqual(["marketing", "utility"])
    expect(combined.categoryAssumed).toBe(true)
  })

  it("recomputes sufficient balance against the combined total", () => {
    // Each message alone fits the wallet; the sequence does not. The per-call
    // flag can only ever answer the first question.
    const combined = combineEstimates([
      estimate({ totalMicros: "89000000", walletBalanceMicros: "100000000", sufficientBalance: true }),
      estimate({ totalMicros: "89000000", walletBalanceMicros: "100000000", sufficientBalance: true }),
    ])!

    expect(combined.sufficientBalance).toBe(false)
    expect(combined.walletBalanceMicros).toBe("100000000")
  })

  it("keeps the lowest balance seen across the calls", () => {
    const combined = combineEstimates([
      estimate({ walletBalanceMicros: "500000000" }),
      estimate({ walletBalanceMicros: "420000000" }),
    ])!

    expect(combined.walletBalanceMicros).toBe("420000000")
  })
})

describe("distinctTemplates", () => {
  it("dedupes on name and language, counting occurrences in order", () => {
    const steps = [
      { templateName: "welcome", templateLanguage: "en_US" },
      { templateName: "nudge", templateLanguage: "en_US" },
      { templateName: "welcome", templateLanguage: "en_US" },
      { templateName: "welcome", templateLanguage: "hi" },
    ]

    expect(distinctTemplates(steps)).toEqual([
      { templateName: "welcome", templateLanguage: "en_US", occurrences: 2 },
      { templateName: "nudge", templateLanguage: "en_US", occurrences: 1 },
      { templateName: "welcome", templateLanguage: "hi", occurrences: 1 },
    ])
  })

  it("ignores steps with no template chosen yet", () => {
    expect(distinctTemplates([{ templateName: "" }, { templateName: "welcome" }])).toEqual([
      { templateName: "welcome", occurrences: 1 },
    ])
  })
})

describe("expandByOccurrences", () => {
  it("repeats a price once per send, so a reused template is charged twice", () => {
    const priced = [{ estimate: estimate({ totalMicros: "89000000" }), occurrences: 2 }]
    const combined = combineEstimates(expandByOccurrences(priced))!

    expect(combined.totalMicros).toBe("178000000")
    expect(combined.messageCount).toBe(2)
  })
})
