import { describe, expect, it } from "vitest"
import { addTags, splitTags, suggestTags } from "./tags"

describe("splitTags", () => {
  it("splits on the separators CSV import accepts", () => {
    expect(splitTags("VIP, retail;wholesale|b2b\nNew")).toEqual(["vip", "retail", "wholesale", "b2b", "new"])
  })

  // "follow-up. testing" was one tag, not two: a full stop is part of a name.
  it("does not split on a full stop", () => {
    expect(splitTags("v2.0, follow-up. testing")).toEqual(["v2.0", "follow-up. testing"])
  })
})

describe("addTags", () => {
  it("keeps order and skips duplicates", () => {
    expect(addTags(["vip"], ["Retail", "VIP", "retail"])).toEqual(["vip", "retail"])
  })
})

describe("suggestTags", () => {
  const known = ["diwali-sale", "vip", "sale-oct", "retail"]

  it("puts prefix matches before other matches", () => {
    expect(suggestTags("sale", known, [])).toEqual(["sale-oct", "diwali-sale"])
  })

  it("leaves out tags already chosen", () => {
    expect(suggestTags("", known, ["vip"])).toEqual(["diwali-sale", "sale-oct", "retail"])
  })
})
