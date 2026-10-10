import { describe, expect, it } from "vitest"
import {
  campaignsInsight,
  contactsInsight,
  dashboardInsight,
  dripsInsight,
} from "./insights"

describe("dashboardInsight", () => {
  const healthy = {
    recipients: { sentCount: 1000, failedCount: 5, skippedCount: 2, totalRecipients: 1007 },
    campaigns: { total: 4, byStatus: { paused: 0 } },
    contactCount: 1200,
  }

  it("says nothing when there is nothing to do", () => {
    // A screen of healthy numbers gets no banner. "Your delivery rate is fine"
    // is a compliment, not an insight.
    expect(dashboardInsight(healthy)).toBeNull()
  })

  it("leaves rate advice to RateInterpretation", () => {
    // Failure, delivery and read rates are explained in the card directly below
    // this banner. Repeating them here in different words is the duplication
    // this rule set exists to avoid.
    expect(
      dashboardInsight({
        ...healthy,
        recipients: { sentCount: 1000, failedCount: 300, skippedCount: 0, totalRecipients: 1000 },
      }),
    ).toBeNull()
  })

  it("surfaces skipped recipients, which never appear on the delivery tiles", () => {
    const insight = dashboardInsight({
      ...healthy,
      recipients: { sentCount: 600, failedCount: 3, skippedCount: 400, totalRecipients: 1000 },
    })

    expect(insight?.id).toBe("skipped-recipients-high")
    expect(insight?.message).toContain("400")
  })

  it("nudges a first broadcast only once there are contacts to send to", () => {
    const noCampaigns = { ...healthy, campaigns: { total: 0, byStatus: { paused: 0 } } }

    expect(dashboardInsight({ ...noCampaigns, contactCount: 3 })).toBeNull()
    expect(dashboardInsight({ ...noCampaigns, contactCount: 900 })?.id).toBe("no-campaigns-yet")
  })

  it("reports paused campaigns with agreeing verbs", () => {
    expect(
      dashboardInsight({ ...healthy, campaigns: { total: 4, byStatus: { paused: 1 } } })?.message,
    ).toContain("1 campaign is paused")
    expect(
      dashboardInsight({ ...healthy, campaigns: { total: 4, byStatus: { paused: 3 } } })?.message,
    ).toContain("3 campaigns are paused")
  })

  it("survives a screen that has loaded nothing yet", () => {
    expect(dashboardInsight({})).toBeNull()
  })
})

describe("contactsInsight", () => {
  it("stays quiet until the opt-in count is known", () => {
    // Null is "not loaded", not "zero opted in" — the difference is a banner
    // telling someone their whole list is unreachable while a fetch is in
    // flight.
    expect(contactsInsight({ total: 500, optedInTotal: null })).toBeNull()
  })

  it("counts the unreachable rather than the opted-in", () => {
    const insight = contactsInsight({ total: 400, optedInTotal: 250 })
    expect(insight?.id).toBe("contacts-not-opted-in")
    expect(insight?.message).toContain("150")
    // The filter is on the same screen, so there is no link back to it.
    expect(insight?.action).toBeUndefined()
  })

  it("ignores a small list, where a share is a handful of rows", () => {
    expect(contactsInsight({ total: 8, optedInTotal: 2 })).toBeNull()
  })

  it("suggests tagging only on a list too big to send to whole", () => {
    expect(contactsInsight({ total: 40, optedInTotal: 40, hasTags: false })).toBeNull()
    expect(contactsInsight({ total: 600, optedInTotal: 600, hasTags: false })?.id).toBe(
      "contacts-untagged",
    )
    expect(contactsInsight({ total: 600, optedInTotal: 600, hasTags: true })).toBeNull()
  })
})

describe("campaignsInsight", () => {
  const campaign = {
    id: "c1",
    name: "Diwali offer",
    status: "completed",
    sentCount: 800,
    failedCount: 8,
    readCount: 500,
    trackLinks: true,
    completedAt: "2026-08-01T10:00:00Z",
  }

  it("reads the most recently completed campaign, not the newest row", () => {
    const insight = campaignsInsight({
      campaigns: [
        { ...campaign, id: "old", name: "Old", failedCount: 200, completedAt: "2026-07-01T10:00:00Z" },
        { ...campaign, id: "new", name: "New", failedCount: 3, completedAt: "2026-08-20T10:00:00Z" },
      ],
    })

    // The newer one is healthy, so nothing fires — the older failure is history.
    expect(insight).toBeNull()
  })

  it("flags a failed send rate with the campaign it belongs to", () => {
    const insight = campaignsInsight({
      campaigns: [{ ...campaign, failedCount: 240 }],
    })

    expect(insight?.id).toBe("last-campaign-failures")
    expect(insight?.message).toContain("Diwali offer")
    expect(insight?.action?.href).toBe("/dashboard/campaigns/c1")
  })

  it("mentions missing link tracking, which has no click count to show", () => {
    expect(campaignsInsight({ campaigns: [{ ...campaign, trackLinks: false }] })?.id).toBe(
      "last-campaign-untracked",
    )
  })

  it("ignores campaigns still running and ones too small to score", () => {
    expect(campaignsInsight({ campaigns: [{ ...campaign, status: "running" }] })).toBeNull()
    expect(campaignsInsight({ campaigns: [{ ...campaign, sentCount: 10, failedCount: 9 }] })).toBeNull()
  })
})

describe("dripsInsight", () => {
  it("leads with a switched-off sequence still holding enrolments", () => {
    const insight = dripsInsight({
      drips: [
        { id: "d1", name: "Welcome", isActive: false, enrollments: { active: 42 } },
        { id: "d2", name: "Winback", isActive: true, exitConditions: [], enrollments: { active: 5 } },
      ],
    })

    expect(insight?.id).toBe("drips-inactive-with-enrollments")
    expect(insight?.message).toContain("Welcome")
    expect(insight?.message).toContain("42")
  })

  it("sums held enrolments across several stalled sequences", () => {
    const insight = dripsInsight({
      drips: [
        { id: "d1", name: "A", isActive: false, enrollments: { active: 10 } },
        { id: "d2", name: "B", isActive: false, enrollments: { active: 7 } },
      ],
    })

    expect(insight?.message).toContain("2 switched-off sequences")
    expect(insight?.message).toContain("17")
  })

  it("mentions missing stop conditions only on a running sequence with people in it", () => {
    expect(
      dripsInsight({
        drips: [{ id: "d1", name: "Winback", isActive: true, exitConditions: [], enrollments: { active: 12 } }],
      })?.id,
    ).toBe("drips-without-exit-conditions")

    // Nobody enrolled: nothing is being sent, so there is nothing to stop.
    expect(
      dripsInsight({
        drips: [{ id: "d1", name: "Winback", isActive: true, exitConditions: [], enrollments: { active: 0 } }],
      }),
    ).toBeNull()
  })

  it("stays quiet when stop conditions weren't loaded at all", () => {
    // A list endpoint that omits the field is not the same as a sequence with
    // no stop conditions, and the difference is a false accusation.
    expect(
      dripsInsight({
        drips: [{ id: "d1", name: "Winback", isActive: true, enrollments: { active: 12 } }],
      }),
    ).toBeNull()
  })

  it("says nothing about a sequence that already has stop conditions", () => {
    expect(
      dripsInsight({
        drips: [
          { id: "d1", name: "Winback", isActive: true, exitConditions: [{}], enrollments: { active: 12 } },
        ],
      }),
    ).toBeNull()
  })
})
