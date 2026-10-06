import { describe, expect, it } from "vitest"
import { optionKey, wabaNumberOptions } from "./waba-number-options"

describe("wabaNumberOptions", () => {
  it("offers every number in a WABA, not just the first", () => {
    const options = wabaNumberOptions([
      { id: "waba-1", name: "Shop", details: { id: "pn-1" }, numbers: [{ id: "pn-1" }, { id: "pn-2" }] },
    ])
    expect(options.map(optionKey)).toEqual(["waba-1:pn-1", "waba-1:pn-2"])
    expect(options[1]).toMatchObject({ id: "waba-1", name: "Shop", details: { id: "pn-2" } })
  })

  it("keeps a WABA with no numbers as one option, for the add-a-number form", () => {
    expect(wabaNumberOptions([{ id: "waba-1", details: null, numbers: [] }])).toEqual([
      { id: "waba-1", details: null, numbers: [] },
    ])
  })

  it("falls back to `details` from a backend that sends no list", () => {
    expect(wabaNumberOptions([{ id: "waba-1", details: { id: "pn-1" } }]).map(optionKey)).toEqual(["waba-1:pn-1"])
  })
})

describe("optionKey", () => {
  it("tells two numbers in one WABA apart", () => {
    expect(optionKey({ id: "w", details: { id: "a" } })).not.toBe(optionKey({ id: "w", details: { id: "b" } }))
    expect(optionKey(null)).toBe("")
  })
})
