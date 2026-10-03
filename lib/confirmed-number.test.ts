import { describe, expect, it } from "vitest"
import { confirmedNumber } from "./confirmed-number"

const ours = [
  { phoneNumberId: "1242121662312769", displayPhoneNumber: "+91 70147 97914", verifiedName: "dheeraj" },
  { phoneNumberId: "1327927453737176", displayPhoneNumber: "+91 73939 39703", verifiedName: "Sahastra" },
]

describe("confirmedNumber", () => {
  it("uses Meta's details when they are this number's", () => {
    const meta = { id: "1327927453737176", display_phone_number: "+91 73939 39703", verified_name: "Sahastra (Meta)" }
    expect(confirmedNumber("1327927453737176", meta, ours)).toEqual({
      details: meta,
      phoneNumber: "+91 73939 39703",
      displayName: "Sahastra (Meta)",
    })
  })

  // The production case: the WABA belongs to another business, so Meta's list
  // has nothing for it.
  it("falls back to our row when Meta's list has no details", () => {
    expect(confirmedNumber("1242121662312769", null, ours)).toEqual({
      details: null,
      phoneNumber: "+91 70147 97914",
      displayName: "dheeraj",
    })
  })

  it("ignores Meta's details when they belong to another number in the WABA", () => {
    const meta = { id: "999", display_phone_number: "+1 555", verified_name: "Other" }
    expect(confirmedNumber("1242121662312769", meta, ours)).toEqual({
      details: null,
      phoneNumber: "+91 70147 97914",
      displayName: "dheeraj",
    })
  })

  it("returns empty strings when nothing knows the number", () => {
    expect(confirmedNumber("555", null, undefined)).toEqual({ details: null, phoneNumber: "", displayName: "" })
  })

  it("accepts Meta's details without an id or without a picked number", () => {
    const meta = { display_phone_number: "+91 1", verified_name: "Shop" }
    expect(confirmedNumber("123", meta, []).phoneNumber).toBe("+91 1")
    expect(confirmedNumber("", { id: "9", verified_name: "X" }, ours).displayName).toBe("X")
  })
})
