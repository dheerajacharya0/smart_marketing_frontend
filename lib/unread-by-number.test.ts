import { describe, expect, it } from "vitest"
import { unreadForNumber, unreadOnOtherNumbers } from "./unread-by-number"

const unread = { total: 7, conversations: 2, byPhoneNumber: { first: 2, second: 5 } }

describe("unreadForNumber", () => {
  it("counts only the active number", () => {
    expect(unreadForNumber(unread, "first")).toBe(2)
    expect(unreadForNumber(unread, "second")).toBe(5)
  })

  it("is zero for a number with nothing unread", () => {
    expect(unreadForNumber(unread, "third")).toBe(0)
  })

  it("falls back to the account total on a backend without the breakdown", () => {
    expect(unreadForNumber({ total: 7, conversations: 2 }, "first")).toBe(7)
  })

  it("is zero with nothing loaded", () => {
    expect(unreadForNumber(undefined, "first")).toBe(0)
  })
})

describe("unreadOnOtherNumbers", () => {
  it("sums every number but the active one", () => {
    expect(unreadOnOtherNumbers(unread, "first")).toBe(5)
    expect(unreadOnOtherNumbers(unread, "second")).toBe(2)
  })

  it("is zero without the breakdown, rather than double-counting the total", () => {
    expect(unreadOnOtherNumbers({ total: 7, conversations: 2 }, "first")).toBe(0)
  })
})
