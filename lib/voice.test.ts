import { describe, expect, it } from "vitest"
import {
  formatCallDuration,
  formatVoiceCharge,
  voiceCallErrorHint,
  voiceCallOutcome,
  voiceLanguageLabel,
} from "./voice"

const call = (over: Partial<Parameters<typeof voiceCallOutcome>[0]> = {}) => ({
  status: "completed" as const,
  endReason: null,
  metaStatus: null,
  billedSeconds: null,
  direction: "inbound" as const,
  ...over,
})

describe("voiceCallOutcome", () => {
  it("separates live calls from finished ones", () => {
    expect(voiceCallOutcome(call({ status: "created" })).tone).toBe("live")
    expect(voiceCallOutcome(call({ status: "in_progress" })).tone).toBe("live")
  })

  it("calls a billed call answered", () => {
    expect(voiceCallOutcome(call({ billedSeconds: 42 }))).toEqual({
      label: "Answered",
      tone: "good",
    })
  })

  // "Completed" only means the call ended cleanly. Nobody picked up here.
  it("does not report an unanswered call as answered", () => {
    expect(voiceCallOutcome(call({ direction: "outbound" })).label).toBe("No answer")
    expect(voiceCallOutcome(call({ metaStatus: "REJECTED" })).label).toBe("Declined")
    expect(voiceCallOutcome(call()).label).toBe("Ended, nothing said")
  })

  it("names the failure so it is actionable", () => {
    expect(
      voiceCallOutcome(call({ status: "failed", endReason: "no_call_permission" })),
    ).toEqual({ label: "No call permission", tone: "warn" })
    expect(voiceCallOutcome(call({ status: "failed", endReason: "provider_error" })).tone).toBe(
      "bad",
    )
    expect(voiceCallOutcome(call({ status: "failed", endReason: "surprise" })).label).toBe(
      "Failed",
    )
  })

  it("flags a call cut off by the time limit even though it was billed", () => {
    expect(
      voiceCallOutcome(call({ billedSeconds: 900, endReason: "max_duration" })),
    ).toEqual({ label: "Ended (time limit)", tone: "warn" })
  })
})

describe("formatting", () => {
  it("formats durations, and says nothing for a call that never connected", () => {
    expect(formatCallDuration(45)).toBe("0:45")
    expect(formatCallDuration(125)).toBe("2:05")
    expect(formatCallDuration(null)).toBe("—")
    expect(formatCallDuration(-1)).toBe("—")
  })

  it("formats micros as rupees", () => {
    expect(formatVoiceCharge("1080000")).toBe("₹1.08")
    expect(formatVoiceCharge("0")).toBe("₹0.00")
    expect(formatVoiceCharge(null)).toBe("—")
    expect(formatVoiceCharge("not-a-number")).toBe("—")
  })

  it("labels languages", () => {
    expect(voiceLanguageLabel("hi-IN")).toBe("Hindi / Hinglish")
    expect(voiceLanguageLabel("xx-XX")).toBe("xx-XX")
  })
})

describe("voiceCallErrorHint", () => {
  it("turns the common half-configured states into instructions", () => {
    expect(voiceCallErrorHint("voice providers not configured")).toMatch(/provider keys/i)
    expect(voiceCallErrorHint("Voice is not configured")).toMatch(/VOICE_SERVICE_SECRET/)
    expect(voiceCallErrorHint("Failed to fetch")).toMatch(/CORS_ORIGINS/)
    expect(voiceCallErrorHint("Payment Required")).toMatch(/wallet/i)
  })

  it("passes anything else through unchanged", () => {
    expect(voiceCallErrorHint("Voice agent is disabled")).toBe("Voice agent is disabled")
  })
})
