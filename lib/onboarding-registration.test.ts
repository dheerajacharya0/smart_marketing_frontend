import { describe, expect, it } from "vitest"
import { isNumberConnectedHere, isNumberRegistered } from "./onboarding-registration"

describe("isNumberConnectedHere", () => {
  it("is true only when our own row is registered", () => {
    expect(isNumberConnectedHere("123", [{ phoneNumberId: "123", status: "registered" }])).toBe(true)
    expect(isNumberConnectedHere("123", [{ phoneNumberId: "123", status: "pending" }])).toBe(false)
    expect(isNumberConnectedHere("123", [])).toBe(false)
    expect(isNumberConnectedHere(undefined, [{ phoneNumberId: "", status: "registered" }])).toBe(false)
  })

  // The bug: Meta's test number is on the Cloud API for everyone, so it read
  // as "Connected" while this app had no record of it.
  it("ignores Meta registration, which says nothing about this app", () => {
    expect(isNumberRegistered("123", { platform_type: "CLOUD_API" }, [])).toBe(true)
    expect(isNumberConnectedHere("123", [])).toBe(false)
  })
})

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

  // Deregistered at Meta after we registered it: our row is stale, and
  // skipping the PIN would finish a number that can't send.
  it("trusts Meta over a stale row of ours", () => {
    expect(
      isNumberRegistered("123", { platform_type: "NOT_APPLICABLE" }, [{ phoneNumberId: "123", status: "registered" }])
    ).toBe(false)
  })

  it("is false without a number id", () => {
    expect(isNumberRegistered(undefined, { platform_type: "CLOUD_API" }, [])).toBe(false)
    expect(isNumberRegistered("", null, [{ phoneNumberId: "", status: "registered" }])).toBe(false)
  })
})
