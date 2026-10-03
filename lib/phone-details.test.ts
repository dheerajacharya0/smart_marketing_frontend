import { describe, expect, it } from "vitest"
import { phoneDetailRows } from "./phone-details"

// What Meta returned live for the Sahastra number.
const live = {
  verified_name: "Sahastra",
  code_verification_status: "VERIFIED",
  display_phone_number: "+91 73939 39703",
  quality_rating: "GREEN",
  platform_type: "CLOUD_API",
  throughput: { level: "STANDARD" },
  last_onboarded_time: "2026-10-01T14:17:42+0000",
  webhook_configuration: { application: "https://example.test/webhook" },
  id: "1327927453737176",
}

describe("phoneDetailRows", () => {
  it("never renders [object Object]", () => {
    const rows = phoneDetailRows(live)
    expect(rows.some((r) => r.value.includes("[object"))).toBe(false)
  })

  it("labels and formats the known fields in a fixed order", () => {
    const rows = phoneDetailRows(live)
    expect(rows.map((r) => r.label)).toEqual([
      "Number",
      "Display name",
      "Verification",
      "Quality",
      "Platform",
      "Throughput",
      "Onboarded",
      "Phone number ID",
    ])
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]))
    expect(byLabel.Number).toBe("+91 73939 39703")
    expect(byLabel.Verification).toBe("Verified")
    expect(byLabel.Quality).toBe("Green")
    expect(byLabel.Platform).toBe("Cloud API")
    expect(byLabel.Throughput).toBe("Standard")
    expect(byLabel.Onboarded).toBe(new Date("2026-10-01T14:17:42+00:00").toLocaleDateString())
  })

  it("leaves out nested objects it has no format for, like the webhook config", () => {
    expect(phoneDetailRows(live).some((r) => r.value.includes("example.test"))).toBe(false)
  })

  it("keeps unknown plain fields with a readable label", () => {
    expect(phoneDetailRows({ name_status: "APPROVED", is_official_business_account: false })).toEqual([
      { label: "Name Status", value: "APPROVED" },
      { label: "Is Official Business Account", value: "false" },
    ])
  })

  it("shows an unregistered number's platform plainly", () => {
    expect(phoneDetailRows({ platform_type: "NOT_APPLICABLE" })).toEqual([{ label: "Platform", value: "Not registered" }])
  })

  it("skips empty values and handles no details", () => {
    expect(phoneDetailRows({ verified_name: "", quality_rating: null, throughput: {} })).toEqual([])
    expect(phoneDetailRows(null)).toEqual([])
  })

  it("keeps an unparseable date as Meta sent it", () => {
    expect(phoneDetailRows({ last_onboarded_time: "soon" })).toEqual([{ label: "Onboarded", value: "soon" }])
  })
})
