import { describe, expect, it } from "vitest"
import { forActiveNumber } from "./active-number-scope"

const items = [
  { id: "a", phoneNumberId: "first" },
  { id: "b", phoneNumberId: "second" },
  { id: "c", phoneNumberId: "first" },
]

describe("forActiveNumber", () => {
  it("keeps only the active number's items", () => {
    expect(forActiveNumber(items, "second").map((i) => i.id)).toEqual(["b"])
    expect(forActiveNumber(items, "first").map((i) => i.id)).toEqual(["a", "c"])
  })

  it("is empty for a number with nothing of its own, not the other number's items", () => {
    expect(forActiveNumber(items, "third")).toEqual([])
  })

  it("passes everything through while the number is unknown", () => {
    expect(forActiveNumber(items, null)).toHaveLength(3)
    expect(forActiveNumber(items, undefined)).toHaveLength(3)
  })
})
