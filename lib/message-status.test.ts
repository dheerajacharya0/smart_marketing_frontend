import { describe, expect, it } from "vitest"
import {
  failureFromPayload,
  failureReason,
  isTerminalFailure,
  mergeStatus,
  statusRank,
} from "./message-status"

describe("statusRank", () => {
  it("orders the delivery progression", () => {
    expect(statusRank("sent")).toBeLessThan(statusRank("delivered"))
    expect(statusRank("delivered")).toBeLessThan(statusRank("read"))
    expect(statusRank("read")).toBeLessThan(statusRank("failed"))
  })

  it("ranks a queued send below anything Meta has confirmed", () => {
    expect(statusRank("accepted")).toBe(0)
    expect(statusRank("pending")).toBe(0)
    expect(statusRank(undefined)).toBe(0)
    expect(statusRank(null)).toBe(0)
  })

  it("is case-insensitive", () => {
    expect(statusRank("READ")).toBe(statusRank("read"))
  })
})

describe("mergeStatus", () => {
  it("upgrades along the progression", () => {
    expect(mergeStatus("accepted", "sent")).toBe("sent")
    expect(mergeStatus("sent", "delivered")).toBe("delivered")
    expect(mergeStatus("delivered", "read")).toBe("read")
  })

  it("ignores a late delivered that would un-read a read message", () => {
    // Meta redelivers status webhooks and they arrive out of order.
    expect(mergeStatus("read", "delivered")).toBe("read")
    expect(mergeStatus("read", "sent")).toBe("read")
    expect(mergeStatus("delivered", "sent")).toBe("delivered")
  })

  it("never lets anything talk a failure back into a success", () => {
    expect(mergeStatus("failed", "delivered")).toBe("failed")
    expect(mergeStatus("failed", "read")).toBe("failed")
    expect(mergeStatus("failed", "sent")).toBe("failed")
  })

  it("lets a failure land on top of a delivery", () => {
    expect(mergeStatus("read", "failed")).toBe("failed")
    expect(mergeStatus("delivered", "failed")).toBe("failed")
  })

  it("keeps what it has when nothing new arrives", () => {
    expect(mergeStatus("read", undefined)).toBe("read")
    expect(mergeStatus(undefined, "sent")).toBe("sent")
    expect(mergeStatus(undefined, undefined)).toBeUndefined()
  })
})

describe("isTerminalFailure", () => {
  it("is true only for failed", () => {
    expect(isTerminalFailure("failed")).toBe(true)
    expect(isTerminalFailure("FAILED")).toBe(true)
    expect(isTerminalFailure("delivered")).toBe(false)
    expect(isTerminalFailure(undefined)).toBe(false)
  })
})

describe("failureFromPayload", () => {
  it("reads the reason a realtime status row only carries in its payload", () => {
    // The socket delivers the status row; the backend mirrors errorCode/Title/
    // Details onto the *outbound* row in a separate UPDATE, so those columns
    // are null here and Meta's errors[] is the only copy.
    expect(
      failureFromPayload({
        id: "wamid.X",
        status: "failed",
        errors: [
          {
            code: 131026,
            title: "Message undeliverable",
            error_data: { details: "Receiver is incapable of receiving this message" },
          },
        ],
      })
    ).toEqual({
      code: 131026,
      title: "Message undeliverable",
      details: "Receiver is incapable of receiving this message",
    })
  })

  it("is empty for a payload with no error — a delivered or read status", () => {
    expect(failureFromPayload({ id: "wamid.X", status: "delivered" })).toEqual({})
    expect(failureFromPayload({ errors: [] })).toEqual({})
    expect(failureFromPayload(null)).toEqual({})
    expect(failureFromPayload(undefined)).toEqual({})
  })

  it("tolerates a partial error object", () => {
    expect(failureFromPayload({ errors: [{ code: 131047 }] })).toEqual({
      code: 131047,
      title: null,
      details: null,
    })
  })

  it("feeds failureReason end to end", () => {
    const payload = { errors: [{ code: 131047, title: "Re-engagement message" }] }
    expect(failureReason(failureFromPayload(payload))).toMatch(/24-hour window/)
  })
})

describe("failureReason", () => {
  it("replaces Meta's generic title for the codes that come up most", () => {
    const reason = failureReason({ code: 131026, title: "Message undeliverable" })
    expect(reason).toMatch(/isn't on WhatsApp/)
    expect(reason).not.toMatch(/Message undeliverable/)
  })

  it("keeps the specific half alongside the friendly wording", () => {
    const reason = failureReason({
      code: 131026,
      title: "Message undeliverable",
      details: "Receiver is incapable of receiving this message",
    })
    expect(reason).toMatch(/isn't on WhatsApp/)
    expect(reason).toMatch(/Receiver is incapable/)
  })

  it("explains the 24-hour window", () => {
    expect(failureReason({ code: 131047 })).toMatch(/24-hour window/)
  })

  it("prefers errorDetails over the generic errorTitle", () => {
    expect(failureReason({ code: 133010, title: "Generic error", details: "Account not registered" }))
      .toBe("Account not registered (error 133010)")
  })

  it("shows the raw code plus text for anything unrecognised", () => {
    expect(failureReason({ code: 470, title: "Re-engagement message" })).toBe(
      "Re-engagement message (error 470)"
    )
  })

  it("still says something when Meta sent no text at all", () => {
    expect(failureReason({ code: 12345 })).toBe("Delivery failed (error 12345)")
    expect(failureReason({})).toBe("Delivery failed")
  })
})
