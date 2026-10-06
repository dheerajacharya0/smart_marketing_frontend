import { describe, expect, it } from "vitest"
import { coexistenceSyncState } from "./coexistence-sync"

const now = Date.UTC(2026, 9, 6, 12)
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString()

describe("coexistenceSyncState", () => {
  it("offers a retry inside Meta's 24 hours", () => {
    const state = coexistenceSyncState(
      { coexistence: true, coexistenceOnboardedAt: hoursAgo(2), coexistenceSyncError: "chat history: down" },
      now
    )
    expect(state).toEqual({
      kind: "retry",
      deadline: new Date(now + 22 * 3600_000),
      error: "chat history: down",
    })
  })

  it("says it expired once the window has closed", () => {
    expect(
      coexistenceSyncState(
        { coexistence: true, coexistenceOnboardedAt: hoursAgo(25), coexistenceSyncError: "x" },
        now
      ).kind
    ).toBe("expired")
  })

  it("has nothing to say about a started import, a clean one, or an ordinary number", () => {
    expect(
      coexistenceSyncState(
        {
          coexistence: true,
          coexistenceOnboardedAt: hoursAgo(1),
          coexistenceSyncStartedAt: hoursAgo(1),
          coexistenceSyncError: "old",
        },
        now
      ).kind
    ).toBe("none")
    expect(coexistenceSyncState({ coexistence: true, coexistenceOnboardedAt: hoursAgo(1) }, now).kind).toBe("none")
    expect(coexistenceSyncState({ coexistence: false, coexistenceSyncError: "x" }, now).kind).toBe("none")
    expect(coexistenceSyncState({}, now).kind).toBe("none")
  })
})
