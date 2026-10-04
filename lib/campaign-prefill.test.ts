import { describe, expect, it } from "vitest"
import type { Campaign } from "@/services/api"
import { duplicatePrefill, followUpCounts, followUpPrefill, relabelForToday } from "./campaign-prefill"

const campaign = {
  id: "c1",
  name: "Diwali Sale",
  templateName: "promo",
  templateLanguage: "en_US",
  templateParameters: ["{{name}}"],
  audienceTag: "vip",
  segmentId: null,
  trackLinks: true,
  recipientTags: ["diwali-sale-30-sep", "follow-up"],
  sentCount: 10,
  readCount: 6,
  repliedCount: 2,
} as unknown as Campaign

const oct1 = new Date(2026, 9, 1)

describe("relabelForToday", () => {
  it("moves a dated label to today", () => {
    expect(relabelForToday("diwali-sale-30-sep", oct1)).toBe("diwali-sale-1-oct")
  })

  it("keeps a label without a date", () => {
    expect(relabelForToday("follow-up", oct1)).toBe("follow-up")
  })
})

describe("duplicatePrefill", () => {
  it("copies the message and audience and dates the labels today", () => {
    const p = duplicatePrefill(campaign, oct1)
    expect(p).toMatchObject({
      kind: "duplicate",
      templateName: "promo",
      templateParameters: ["{{name}}"],
      trackLinks: true,
      audience: { mode: "tag", tag: "vip" },
      labels: ["diwali-sale-1-oct", "follow-up"],
    })
  })

  it("keeps following the same campaign when duplicating a follow-up", () => {
    const p = duplicatePrefill(
      { ...campaign, followUpCampaignId: "c0", followUpFilter: "not_read" } as Campaign,
      oct1
    )
    expect(p.audience).toMatchObject({ mode: "followUp", campaignId: "c0", filter: "not_read" })
  })
})

describe("duplicatePrefill with tag rules", () => {
  it("carries the rules, not the plain tag", () => {
    const rules = {
      combinator: "and" as const,
      conditions: [
        { type: "tag" as const, operator: "has" as const, value: "diwali" },
        { type: "tag" as const, operator: "not_has" as const, value: "sent-2-oct" },
      ],
    }
    const p = duplicatePrefill({ ...campaign, audienceTag: null, audienceRules: rules } as Campaign, oct1)
    expect(p.audience).toEqual({ mode: "tagRules", rules })
  })
})

describe("followUpPrefill", () => {
  it("targets the campaign's recipients and leaves the message open", () => {
    const p = followUpPrefill(campaign, "not_replied")
    expect(p.audience).toEqual({
      mode: "followUp",
      campaignId: "c1",
      campaignName: "Diwali Sale",
      filter: "not_replied",
    })
    expect(p.templateName).toBe("")
    expect(p.labels).toBeUndefined()
  })
})

describe("followUpCounts", () => {
  it("derives each group from the campaign's counters", () => {
    expect(followUpCounts(campaign)).toEqual({ reached: 10, replied: 2, not_replied: 8, not_read: 4 })
  })
})
