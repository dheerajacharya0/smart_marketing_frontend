import { describe, expect, it } from "vitest"
import {
  describeChange,
  explainNoAttribution,
  formatReturn,
  percentChange,
  senderHref,
  sourceLabel,
} from "./ledger"

describe("formatReturn", () => {
  it("shows two decimals under 10x and one above", () => {
    expect(formatReturn(1.05)).toBe("1.05×")
    expect(formatReturn(12.81)).toBe("12.8×")
  })

  it("drops trailing zeros", () => {
    expect(formatReturn(2)).toBe("2×")
    expect(formatReturn(1.5)).toBe("1.5×")
    expect(formatReturn(20)).toBe("20×")
  })

  // Nothing spent is a different fact from spending and earning nothing.
  it("is a dash when nothing was spent, and 0x when spend earned nothing", () => {
    expect(formatReturn(null)).toBe("—")
    expect(formatReturn(0)).toBe("0×")
  })
})

describe("percentChange", () => {
  it("is relative to the previous figure", () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
  })

  it("has no percentage when the previous figure is zero", () => {
    expect(percentChange(10, 0)).toBeNull()
  })
})

describe("describeChange", () => {
  it("words a rise and a fall", () => {
    expect(describeChange(112, 100)).toBe("+12% vs previous")
    expect(describeChange(92, 100)).toBe("−8% vs previous")
  })

  it("calls a jump from zero new, and no change the same", () => {
    expect(describeChange(5, 0)).toBe("new this period")
    expect(describeChange(0, 0)).toBe("same as previous")
    expect(describeChange(100.2, 100)).toBe("same as previous")
  })
})

describe("sourceLabel", () => {
  it("names known sources and passes unknown ones through", () => {
    expect(sourceLabel("manual")).toBe("Inbox replies")
    expect(sourceLabel("unattributed")).toBe("Not attributed")
    expect(sourceLabel("something-new")).toBe("something-new")
  })
})

describe("senderHref", () => {
  it("links each sender to its page", () => {
    expect(senderHref("campaign", "c1")).toBe("/dashboard/campaigns/c1")
    expect(senderHref("drip", "d1")).toBe("/dashboard/drips/d1")
    expect(senderHref("flow", "f1")).toBe("/dashboard/flows/f1")
    expect(senderHref("automation", "r1")).toBe("/dashboard/automation")
  })
})

describe("explainNoAttribution", () => {
  const base = { orders: 3, attributedOrders: 0, messages: 40, windowDays: 7 }

  it("is silent once anything is attributed", () => {
    expect(explainNoAttribution({ ...base, attributedOrders: 1 })).toBeNull()
  })

  it("says which of the three cases it is", () => {
    expect(explainNoAttribution({ ...base, orders: 0 })).toMatch(/No sales reported/)
    expect(explainNoAttribution({ ...base, messages: 0 })).toMatch(/no messages were sent/)
    expect(explainNoAttribution(base)).toMatch(/within 7 days of a message/)
    expect(explainNoAttribution({ ...base, windowDays: 1 })).toMatch(/within 1 day of/)
  })
})
