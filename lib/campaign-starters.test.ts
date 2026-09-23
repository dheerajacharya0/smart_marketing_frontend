import { describe, expect, it } from "vitest"
import {
  CAMPAIGN_STARTERS,
  getCampaignStarter,
  starterSegmentName,
} from "@/lib/campaign-starters"
import { SEGMENT_STARTERS } from "@/lib/segment-starters"

describe("campaign starters", () => {
  it("uses distinct ids", () => {
    const ids = CAMPAIGN_STARTERS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("resolves a known id and rejects anything else", () => {
    expect(getCampaignStarter("win-back")?.label).toBe("Win back quiet customers")
    expect(getCampaignStarter("does-not-exist")).toBeUndefined()
    expect(getCampaignStarter(null)).toBeUndefined()
    expect(getCampaignStarter(undefined)).toBeUndefined()
  })

  it("gives every starter a name, a blurb and a template hint", () => {
    for (const starter of CAMPAIGN_STARTERS) {
      expect(starter.name.trim()).not.toBe("")
      expect(starter.blurb.trim()).not.toBe("")
      expect(starter.templateHint.trim()).not.toBe("")
    }
  })

  // The audience link is by *name*, because a saved segment carries no record
  // of which starter built it. That makes a rename in segment-starters.ts a
  // silent break: the wizard would stop matching and quietly offer "everyone"
  // under a campaign called "Win-back". This is the test that catches it.
  it("points every segmentStarterId at a segment starter that exists", () => {
    for (const starter of CAMPAIGN_STARTERS) {
      if (!starter.segmentStarterId) continue
      const match = SEGMENT_STARTERS.find((s) => s.id === starter.segmentStarterId)
      expect(match, `no segment starter "${starter.segmentStarterId}" for "${starter.id}"`).toBeDefined()
    }
  })

  it("resolves a segment name for every starter that claims one", () => {
    for (const starter of CAMPAIGN_STARTERS) {
      if (!starter.segmentStarterId) {
        expect(starterSegmentName(starter)).toBeUndefined()
        continue
      }
      const name = starterSegmentName(starter)
      expect(name, `"${starter.id}" resolved no segment name`).toBeTruthy()
      // The wizard compares this against Segment.name from the API, so it has
      // to be the exact string the builder would save.
      expect(SEGMENT_STARTERS.some((s) => s.name === name)).toBe(true)
    }
  })

  it("offers at least one starter that needs no segment, for a plain announcement", () => {
    expect(CAMPAIGN_STARTERS.some((s) => !s.segmentStarterId)).toBe(true)
  })
})
