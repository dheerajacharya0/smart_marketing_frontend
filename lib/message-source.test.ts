import { describe, expect, it } from "vitest"
import { sharePercent, sourceDescription, sourceLabel } from "./message-source"

describe("sourceLabel", () => {
  it("names every source the backend can return", () => {
    // Mirrors MESSAGE_SOURCES plus the synthetic 'unattributed' bucket the usage
    // endpoint adds. A missing one would render as a raw identifier.
    for (const source of [
      "manual",
      "campaign",
      "drip",
      "automation",
      "flow",
      "system",
      "api",
      "unattributed",
    ] as const) {
      const label = sourceLabel(source)
      expect(label).not.toBe(source)
      expect(label.length).toBeGreaterThan(0)
      expect(sourceDescription(source).length).toBeGreaterThan(0)
    }
  })

  it("renders a dash for a null source rather than 'null'", () => {
    // Credits have no source, and so do debits from before attribution existed.
    expect(sourceLabel(null)).toBe("—")
    expect(sourceLabel(undefined)).toBe("—")
    expect(sourceDescription(null)).toBe("")
  })

  it("passes an unknown value straight through instead of crashing", () => {
    // A source added backend-first should degrade to its identifier, not blank.
    expect(sourceLabel("ctwa" as never)).toBe("ctwa")
  })
})

describe("sharePercent", () => {
  it("computes the share of a total", () => {
    expect(sharePercent(25, 100)).toBe(25)
    expect(sharePercent(1, 3)).toBeCloseTo(33.333, 3)
  })

  it("returns 0 rather than NaN or Infinity when there is no spend", () => {
    expect(sharePercent(0, 0)).toBe(0)
    expect(sharePercent(5, 0)).toBe(0)
    expect(sharePercent(Number.NaN, 100)).toBe(0)
    expect(sharePercent(5, Number.NaN)).toBe(0)
  })

  it("never goes negative on a total that shouldn't be negative", () => {
    expect(sharePercent(5, -10)).toBe(0)
  })
})
