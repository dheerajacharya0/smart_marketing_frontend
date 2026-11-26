import { describe, expect, it } from "vitest"
import { adLabel, adNameResolver } from "./ads"
import { adStarterId, getSegmentStarter } from "./segment-starters"
import { conditionError, describeCondition, fromApiCondition, toApiCondition } from "./segment-rules"
import { describeTrigger, defaultTrigger } from "./automation-rules"

const base = { headline: null, body: null, sourceId: "120200001", sourceType: "ad", adKey: "120200001" }

describe("adLabel", () => {
  it("uses the headline, then the body", () => {
    expect(adLabel({ ...base, headline: " Diwali  sale " })).toBe("Diwali sale")
    expect(adLabel({ ...base, body: "20% off everything" })).toBe("20% off everything")
  })

  it("truncates long text", () => {
    const label = adLabel({ ...base, headline: "x".repeat(200) })
    expect(label).toHaveLength(60)
    expect(label.endsWith("…")).toBe(true)
  })

  it("falls back to a shortened id, naming posts as posts", () => {
    expect(adLabel(base)).toBe("Ad 120200001")
    expect(adLabel({ ...base, sourceId: "120212345678901234" })).toBe("Ad …78901234")
    expect(adLabel({ ...base, sourceType: "post" })).toBe("Post 120200001")
  })

  it("uses the url key when there is no id", () => {
    expect(adLabel({ ...base, sourceId: null, adKey: "https://fb.me/abcdefghijk" })).toBe("Ad …defghijk")
  })
})

describe("adNameResolver", () => {
  it("resolves known keys only", () => {
    const resolve = adNameResolver([
      { ...base, headline: "Diwali sale", sourceUrl: null, mediaType: null, thumbnailUrl: null, clicks: 1, contacts: 1, firstClickAt: "", lastClickAt: "" },
    ])
    expect(resolve("120200001")).toBe("Diwali sale")
    expect(resolve("other")).toBeUndefined()
    expect(adNameResolver(undefined)("x")).toBeUndefined()
  })
})

describe("ad segment condition", () => {
  it("round-trips through the draft model", () => {
    const api = { type: "ad" as const, operator: "within" as const, days: 30, adKey: "120200001" }
    const draft = fromApiCondition(api)
    expect(conditionError(draft)).toBeNull()
    expect(toApiCondition(draft)).toEqual(api)
    const anyAd = toApiCondition({ ...draft, adKey: "" })
    expect(anyAd).toEqual({ type: "ad", operator: "within", days: 30 })
  })

  it("rejects out-of-range days", () => {
    expect(conditionError({ ...fromApiCondition({ type: "ad", operator: "within", days: 1 }), days: "0" })).toBe(
      "Days must be 1–365"
    )
  })

  it("describes with the ad name when known", () => {
    const name = (key: string) => (key === "1" ? "Diwali sale" : undefined)
    expect(describeCondition({ type: "ad", operator: "within", days: 7, adKey: "1" }, undefined, name)).toBe(
      "messaged from the ad “Diwali sale” within 7 days"
    )
    expect(describeCondition({ type: "ad", operator: "not_within", days: 7 })).toBe(
      "didn't message from an ad within 7 days"
    )
  })
})

describe("ad segment starter", () => {
  it("builds a per-ad starter from the query id", () => {
    const starter = getSegmentStarter(adStarterId("120200001"))
    expect(starter?.conditions[0]).toMatchObject({ type: "ad", adKey: "120200001", days: "30" })
    expect(starter?.conditions.every((c) => conditionError(c) === null)).toBe(true)
  })

  it("ignores an empty ad id", () => {
    expect(getSegmentStarter("ad:")).toBeUndefined()
  })
})

describe("ad_click trigger", () => {
  it("defaults to any ad and summarises the count", () => {
    expect(defaultTrigger("ad_click")).toEqual({ type: "ad_click", adKeys: [] })
    expect(describeTrigger({ type: "ad_click", adKeys: [] })).toBe("Message from any ad")
    expect(describeTrigger({ type: "ad_click", adKeys: ["a", "b"] })).toBe("Message from 2 ads")
  })
})
