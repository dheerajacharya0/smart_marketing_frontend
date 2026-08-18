import { describe, expect, it } from "vitest"
import { microsToUnits, formatMoney, formatSignedMoney } from "./money"

describe("microsToUnits", () => {
  it("converts whole and fractional micros", () => {
    expect(microsToUnits("1000000")).toBe(1)
    expect(microsToUnits("1220000")).toBeCloseTo(1.22, 6)
    expect(microsToUnits("500000")).toBe(0.5)
    expect(microsToUnits("0")).toBe(0)
  })

  it("stays exact across the range a real total can reach", () => {
    // The string wire format exists because micros pass MAX_SAFE_INTEGER at
    // ~9e9 units — well inside what a large broadcast can cost. Dividing as
    // BigInt keeps those exact, where parsing the micros as a Number first
    // would not.
    expect(microsToUnits("9007199254740000")).toBe(9007199254.74)
    expect(microsToUnits("123456789012345000")).toBeCloseTo(123456789012.345, 3)
  })

  it("does not overflow to NaN or Infinity on an absurd figure", () => {
    // Past 2^53 *units* the returned Number necessarily rounds — it is a
    // display value. What matters is that it stays a finite number rather than
    // becoming NaN next to a currency symbol.
    const result = microsToUnits("9007199254740993000000")
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeGreaterThan(9e15)
  })

  it("returns 0 rather than NaN for missing or malformed input", () => {
    // A NaN next to a currency symbol is worse than a zero: it looks broken
    // rather than empty.
    expect(microsToUnits(null)).toBe(0)
    expect(microsToUnits(undefined)).toBe(0)
    expect(microsToUnits("")).toBe(0)
    expect(microsToUnits("not-a-number")).toBe(0)
    expect(microsToUnits("1.5")).toBe(0)
  })

  it("handles a negative figure", () => {
    expect(microsToUnits("-2500000")).toBeCloseTo(-2.5, 6)
  })

  it("feeds formatMoney without losing the sub-unit part", () => {
    // Per-message costs are fractions of a unit, so the two have to compose:
    // rounding here would erase the number the estimate exists to show.
    expect(formatMoney(microsToUnits("1220000"), "INR")).toContain("1.22")
  })
})

describe("formatSignedMoney", () => {
  it("signs by ledger direction, not by the number", () => {
    expect(formatSignedMoney(500, "credit", "INR")).toMatch(/^\+/)
    expect(formatSignedMoney(500, "debit", "INR")).toMatch(/^-/)
  })
})
