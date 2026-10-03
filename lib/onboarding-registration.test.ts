import { describe, expect, it } from "vitest"
import { isNumberRegistered } from "./onboarding-registration"

describe("isNumberRegistered", () => {
  it("is true when our row for the number is registered", () => {
    expect(isNumberRegistered("123", null, [{ phoneNumberId: "123", status: "registered" }])).toBe(true)
  })

  it("is true when Meta reports the number on the Cloud API", () => {
    expect(isNumberRegistered("123", { platform_type: "CLOUD_API" }, [])).toBe(true)
  })

  it("is false for a pending row or another number's row", () => {
    expect(isNumberRegistered("123", null, [{ phoneNumberId: "123", status: "pending" }])).toBe(false)
    expect(isNumberRegistered("123", null, [{ phoneNumberId: "999", status: "registered" }])).toBe(false)
  })

  it("is false when Meta says the number is not on the Cloud API", () => {
    expect(isNumberRegistered("123", { platform_type: "NOT_APPLICABLE" }, null)).toBe(false)
    expect(isNumberRegistered("123", { platform_type: "ON_PREMISE" }, undefined)).toBe(false)
  })

  it("is false without a number id", () => {
    expect(isNumberRegistered(undefined, { platform_type: "CLOUD_API" }, [])).toBe(false)
    expect(isNumberRegistered("", null, [{ phoneNumberId: "", status: "registered" }])).toBe(false)
  })
})
