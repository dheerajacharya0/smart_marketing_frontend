import { describe, it, expect } from "vitest"
import { parseRulesErrorIndex, emptyCondition, conditionNeedsValue } from "./segment-rules"

describe("parseRulesErrorIndex", () => {
  it("pulls the condition index out of a backend error", () => {
    expect(parseRulesErrorIndex("conditions.2 is invalid")).toBe(2)
    expect(parseRulesErrorIndex("conditions[0].value required")).toBe(0)
  })
  it("returns null when no index is present", () => {
    expect(parseRulesErrorIndex("bad rules")).toBeNull()
  })
})

describe("conditionNeedsValue", () => {
  it("is false for existence operators, true otherwise", () => {
    const base = emptyCondition()
    expect(conditionNeedsValue({ ...base, type: "attribute", operator: "exists" })).toBe(false)
    expect(conditionNeedsValue({ ...base, type: "attribute", operator: "not_exists" })).toBe(false)
    expect(conditionNeedsValue({ ...base, type: "attribute", operator: "equals" })).toBe(true)
  })
})
