import { describe, expect, it } from "vitest"
import { isPastMetaRetention } from "./media-expiry"

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 9, 5)

describe("isPastMetaRetention", () => {
  it("is false inside Meta's 30 days", () => {
    expect(isPastMetaRetention(new Date(now - 29 * DAY), now)).toBe(false)
  })

  it("is true past 30 days — the 16 Jul photo opened on 5 Oct", () => {
    expect(isPastMetaRetention(new Date(Date.UTC(2026, 6, 16)), now)).toBe(true)
  })

  it("is false when the time is unknown, so a retry is still offered", () => {
    expect(isPastMetaRetention(undefined, now)).toBe(false)
    expect(isPastMetaRetention(new Date("nope"), now)).toBe(false)
  })
})
