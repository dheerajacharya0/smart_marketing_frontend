import { describe, expect, it } from "vitest"
import { numberLabel, pickAccountNumbers } from "./account-numbers"
import { messagingTierLabel } from "@/components/quality-badge"
import type { WhatsappPhoneNumber } from "@/services/api"

const num = (phoneNumberId: string, extra: Partial<WhatsappPhoneNumber> = {}): WhatsappPhoneNumber => ({
  id: `row-${phoneNumberId}`,
  wabaId: "waba",
  phoneNumberId,
  status: "registered",
  ...extra,
})

describe("pickAccountNumbers", () => {
  // The production case: an old number first in the list, the main one second.
  it("shows the account's main number, not the oldest", () => {
    const old = num("1242121662312769")
    const main = num("1327927453737176", { displayPhoneNumber: "+91 73939 39703" })
    const { primary, others } = pickAccountNumbers("1327927453737176", [old, main])
    expect(primary).toBe(main)
    expect(others).toEqual([old])
  })

  it("falls back to the first registered number when the main one isn't registered", () => {
    const pendingMain = num("main", { status: "pending" })
    const other = num("other")
    const { primary, others } = pickAccountNumbers("main", [pendingMain, other])
    expect(primary).toBe(other)
    expect(others).toEqual([])
  })

  it("falls back to the first registered number when there is no main", () => {
    const a = num("a")
    const b = num("b")
    expect(pickAccountNumbers(undefined, [a, b])).toEqual({ primary: a, others: [b] })
  })

  it("leaves out numbers that aren't registered", () => {
    const { others } = pickAccountNumbers("a", [num("a"), num("p", { status: "pending" })])
    expect(others).toEqual([])
  })

  it("returns nothing for an account without numbers", () => {
    expect(pickAccountNumbers("a", [])).toEqual({ primary: null, others: [] })
    expect(pickAccountNumbers("a", null)).toEqual({ primary: null, others: [] })
  })
})

describe("numberLabel", () => {
  it("prefers digits, then the verified name, then the id", () => {
    expect(numberLabel(num("1", { displayPhoneNumber: "+91 1", verifiedName: "Shop" }))).toBe("+91 1")
    expect(numberLabel(num("1", { verifiedName: "Shop" }))).toBe("Shop")
    expect(numberLabel(num("1"))).toBe("1")
  })
})

describe("messagingTierLabel", () => {
  it("keeps the existing labels", () => {
    expect(messagingTierLabel("TIER_250")).toBe("250 msgs/day")
    expect(messagingTierLabel("TIER_1K")).toBe("1,000/day")
    expect(messagingTierLabel("TIER_UNLIMITED")).toBe("Unlimited")
  })

  it("labels tiers and plain limits it has no entry for", () => {
    expect(messagingTierLabel("TIER_2K")).toBe("2,000/day")
    expect(messagingTierLabel("TIER_50")).toBe("50/day")
    expect(messagingTierLabel("2000")).toBe("2,000/day")
    expect(messagingTierLabel("TIER_1M")).toBe("10,00,000/day")
  })

  it("returns null for anything it can't read", () => {
    expect(messagingTierLabel(null)).toBeNull()
    expect(messagingTierLabel("")).toBeNull()
    expect(messagingTierLabel("TIER_0")).toBeNull()
    expect(messagingTierLabel("tier_1k")).toBeNull()
    expect(messagingTierLabel("0100")).toBeNull()
    expect(messagingTierLabel("constructor")).toBeNull()
  })
})
