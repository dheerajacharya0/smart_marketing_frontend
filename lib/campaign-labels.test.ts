import { describe, expect, it } from "vitest"
import { addLabel, MAX_CAMPAIGN_LABELS, suggestCampaignLabel } from "./campaign-labels"

describe("suggestCampaignLabel", () => {
  const day = new Date(2026, 8, 30)

  it("slugs the name and adds the day", () => {
    expect(suggestCampaignLabel("Diwali Sale!", day)).toBe("diwali-sale-30-sep")
  })

  // The default name is "<template> · <day>"; the label must not repeat the day.
  it("does not repeat a date the name already ends with", () => {
    expect(suggestCampaignLabel("hello_world · 1 Oct", day)).toBe("hello-world-30-sep")
    expect(suggestCampaignLabel("Diwali 30 Sep", day)).toBe("diwali-30-sep")
    expect(suggestCampaignLabel("hello_world · 1 Oct — follow-up", day)).toBe("hello-world-follow-up-30-sep")
  })

  it("falls back when the name has nothing to slug", () => {
    expect(suggestCampaignLabel("!!!", day)).toBe("campaign-30-sep")
  })

  it("keeps a long name to a readable length", () => {
    expect(suggestCampaignLabel("a".repeat(80), day)).toBe(`${"a".repeat(40)}-30-sep`)
  })
})

describe("addLabel", () => {
  it("stores labels the way contact tags are stored", () => {
    expect(addLabel([], "  Follow-Up ")).toEqual(["follow-up"])
  })

  it("ignores duplicates and blanks", () => {
    expect(addLabel(["vip"], "VIP")).toEqual(["vip"])
    expect(addLabel(["vip"], "  ")).toEqual(["vip"])
  })

  it("stops at the limit", () => {
    const full = Array.from({ length: MAX_CAMPAIGN_LABELS }, (_, i) => `l${i}`)
    expect(addLabel(full, "one-more")).toBe(full)
  })
})
