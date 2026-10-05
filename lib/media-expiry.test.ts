import { describe, expect, it } from "vitest"
import { isPastMetaRetention, metaMediaRetentionDays } from "./media-expiry"

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 9, 5)

describe("isPastMetaRetention", () => {
  it("expires customer-sent media after 7 days — Meta keeps it no longer", () => {
    expect(isPastMetaRetention(new Date(now - 6 * DAY), true, now)).toBe(false)
    expect(isPastMetaRetention(new Date(now - 8 * DAY), true, now)).toBe(true)
  })

  it("keeps media we sent until 30 days", () => {
    expect(isPastMetaRetention(new Date(now - 8 * DAY), false, now)).toBe(false)
    expect(isPastMetaRetention(new Date(now - 31 * DAY), false, now)).toBe(true)
  })

  it("is true for the 16 Jul customer photo opened on 5 Oct", () => {
    expect(isPastMetaRetention(new Date(Date.UTC(2026, 6, 16)), true, now)).toBe(true)
  })

  it("is false when the time is unknown, so a retry is still offered", () => {
    expect(isPastMetaRetention(undefined, true, now)).toBe(false)
    expect(isPastMetaRetention(new Date("nope"), true, now)).toBe(false)
  })

  it("names the right number of days for the message", () => {
    expect(metaMediaRetentionDays(true)).toBe(7)
    expect(metaMediaRetentionDays(false)).toBe(30)
  })
})
