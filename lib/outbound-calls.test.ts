// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { applyCallUpdate, callOutcome, dialStatusText, endedLabelFor, isFinalCall } from "./calls"
import { applyAnswer } from "./call-webrtc"
import { dial, onDial } from "./call-dialer"
import type { WhatsappCall } from "@/services/api"

const call = (over: Partial<WhatsappCall>): WhatsappCall =>
  ({
    id: "c1",
    direction: "outbound",
    status: "dialing",
    customerWaId: "919876543210",
    customerName: null,
    endReason: null,
    durationSeconds: null,
    ...over,
  }) as WhatsappCall

describe("outgoing calls never ring the dashboard", () => {
  // Meta reports the customer's phone ringing with the same word.
  it("ignores an outbound call in ringing", () => {
    expect(applyCallUpdate([], call({ status: "ringing" }))).toEqual([])
  })

  it("still rings for an inbound call", () => {
    expect(applyCallUpdate([], call({ direction: "inbound", status: "ringing" }))).toHaveLength(1)
  })
})

describe("dialStatusText", () => {
  it("says calling, then ringing, then gives way to the timer", () => {
    expect(dialStatusText(call({ status: "dialing" }))).toBe("Calling…")
    expect(dialStatusText(call({ status: "ringing" }))).toBe("Ringing…")
    expect(dialStatusText(call({ status: "active" }))).toBeNull()
  })

  it("is silent for incoming calls", () => {
    expect(dialStatusText(call({ direction: "inbound", status: "ringing" }))).toBeNull()
  })
})

describe("endedLabelFor", () => {
  it("words an outgoing call's end from the caller's side", () => {
    expect(endedLabelFor(call({ status: "rejected" }))).toBe("Declined")
    expect(endedLabelFor(call({ status: "missed" }))).toBe("No answer")
    expect(endedLabelFor(call({ status: "missed", endReason: "cancelled_by_agent" }))).toBe("Call cancelled")
    expect(endedLabelFor(call({ status: "failed" }))).toBe("Call failed")
    expect(endedLabelFor(call({ status: "ended" }))).toBe("Call ended")
  })

  it("keeps the incoming wording", () => {
    expect(endedLabelFor(call({ direction: "inbound", status: "missed" }))).toBe("Missed call")
  })
})

describe("callOutcome", () => {
  it("shows the duration of an answered call", () => {
    expect(callOutcome(call({ status: "ended", durationSeconds: 65 }))).toEqual({ label: "1:05", tone: "ok" })
  })

  // Only an incoming missed call is something the team failed to pick up.
  it("flags missed incoming calls, not unanswered outgoing ones", () => {
    expect(callOutcome(call({ direction: "inbound", status: "missed" })).tone).toBe("missed")
    expect(callOutcome(call({ status: "missed" }))).toEqual({ label: "No answer", tone: "muted" })
  })
})

describe("isFinalCall", () => {
  it("knows which statuses end a call", () => {
    expect(isFinalCall(call({ status: "ended" }))).toBe(true)
    expect(isFinalCall(call({ status: "ringing" }))).toBe(false)
  })
})

describe("applyAnswer", () => {
  it("applies the customer's answer to a waiting offer", async () => {
    const pc = { signalingState: "have-local-offer", setRemoteDescription: vi.fn() }
    await expect(applyAnswer(pc as unknown as RTCPeerConnection, "v=0 answer")).resolves.toBe(true)
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "v=0 answer" })
  })

  // The socket and the poll can both deliver it.
  it("does nothing once an answer is in", async () => {
    const pc = { signalingState: "stable", setRemoteDescription: vi.fn() }
    await expect(applyAnswer(pc as unknown as RTCPeerConnection, "v=0 answer")).resolves.toBe(false)
    expect(pc.setRemoteDescription).not.toHaveBeenCalled()
  })
})

describe("dial", () => {
  it("hands the target to whoever listens, until they stop", () => {
    const handler = vi.fn()
    const stop = onDial(handler)
    dial({ phoneNumberId: "pn", customerWaId: "919876543210" })
    stop()
    dial({ phoneNumberId: "pn", customerWaId: "919876543210" })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ phoneNumberId: "pn", customerWaId: "919876543210" })
  })
})
