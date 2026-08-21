import { describe, expect, it } from "vitest"
import { describeApiHealth, describeEnrollmentMix, describeRevenueSplit } from "./metric-reads"

describe("describeEnrollmentMix", () => {
  it("says nothing about a handful of rows", () => {
    // "50% completed" over four enrolments describes nothing.
    expect(describeEnrollmentMix({ active: 2, completed: 2, cancelled: 0, stopped: 0 })).toBeNull()
  })

  it("reports a sequence nobody has finished yet without dividing by zero", () => {
    const read = describeEnrollmentMix({ active: 40, completed: 0, cancelled: 0, stopped: 0 })
    expect(read).toContain("still mid-sequence")
    expect(read).not.toContain("NaN")
  })

  it("scores the ended enrolments, not the active ones", () => {
    // 60 completed of 100 ended; the 100 still running are not failures-in-waiting.
    const read = describeEnrollmentMix({ active: 100, completed: 60, cancelled: 10, stopped: 30 })!
    expect(read).toContain("100 enrolments that have ended")
    expect(read).toContain("60% received every step")
  })

  it("explains a stop as the feature working", () => {
    // The whole reason this function exists: "stopped" reads as breakage and is
    // the opposite — an exit condition noticing a reply.
    const read = describeEnrollmentMix({ active: 5, completed: 30, cancelled: 0, stopped: 20 })!
    expect(read).toContain("40% stopped early")
    expect(read).toContain("not a failure")
  })

  it("leaves out the categories that are empty", () => {
    const read = describeEnrollmentMix({ active: 0, completed: 50, cancelled: 0, stopped: 0 })!
    expect(read).not.toContain("cancelled")
    expect(read).not.toContain("stopped")
  })
})

describe("describeRevenueSplit", () => {
  it("says nothing when no sale has been reported", () => {
    expect(
      describeRevenueSplit({
        conversions: 0,
        attributedConversions: 0,
        revenue: 0,
        attributedRevenue: 0,
      }),
    ).toBeNull()
  })

  it("does not treat unattributed sales as lost revenue", () => {
    const read = describeRevenueSplit({
      conversions: 40,
      attributedConversions: 0,
      revenue: 200000,
      attributedRevenue: 0,
    })!
    expect(read).toContain("Reported revenue still counts")
  })

  it("gives the credited share and refuses the causal claim", () => {
    const read = describeRevenueSplit({
      conversions: 100,
      attributedConversions: 35,
      revenue: 120000,
      attributedRevenue: 42000,
    })!

    expect(read).toContain("35% of reported revenue")
    expect(read).toContain("35 of 100 sales")
    // Last touch is a rule for assigning credit, not a measurement of cause.
    expect(read).toContain("not proof the message caused the sale")
  })

  it("handles everything being attributed without saying 0 remain", () => {
    const read = describeRevenueSplit({
      conversions: 12,
      attributedConversions: 12,
      revenue: 5000,
      attributedRevenue: 5000,
    })!
    expect(read).toContain("Every reported sale")
    expect(read).not.toContain("0 of 12")
  })
})

describe("describeApiHealth", () => {
  it("stays silent on a healthy integration", () => {
    // "No errors" is not news, and a permanent green line is one more thing to
    // stop reading.
    expect(describeApiHealth({ totalRequests: 5000, errors: 0, rateLimited: 0 })).toBeNull()
  })

  it("says nothing when no call has been made", () => {
    expect(describeApiHealth({ totalRequests: 0, errors: 0, rateLimited: 0 })).toBeNull()
  })

  it("points a failure rate at the caller's own systems", () => {
    const read = describeApiHealth({ totalRequests: 1000, errors: 31, rateLimited: 0 })!
    expect(read).toContain("3% of calls failed")
    expect(read).toContain("your systems")
    expect(read).not.toContain("throttled")
  })

  it("separates throttling from failure, because the lever is different", () => {
    const read = describeApiHealth({ totalRequests: 1000, errors: 0, rateLimited: 412 })!
    expect(read).toContain("412 calls were throttled")
    expect(read).toContain("Raise the key's tier")
    expect(read).toContain("retry")
  })

  it("agrees with itself on a single throttled call", () => {
    expect(describeApiHealth({ totalRequests: 10, errors: 0, rateLimited: 1 })).toContain(
      "1 call was throttled",
    )
  })
})
