import { describe, expect, it, vi } from "vitest"
import { applyCallUpdate, callerLabel, formatCallDuration } from "./calls"
import { waitForIceGathering } from "./call-webrtc"
import type { WhatsappCall } from "@/services/api"

const call = (id: string, status: WhatsappCall["status"]): WhatsappCall =>
  ({ id, status, customerWaId: "919876543210", customerName: null }) as WhatsappCall

describe("applyCallUpdate", () => {
  it("adds a newly ringing call at the top", () => {
    const list = applyCallUpdate([call("a", "ringing")], call("b", "ringing"))
    expect(list.map((c) => c.id)).toEqual(["b", "a"])
  })

  // A teammate answering is just another update: every other dashboard stops
  // ringing the moment it arrives.
  it("drops a call the moment it stops ringing", () => {
    for (const status of ["answering", "active", "missed", "rejected", "ended"] as const) {
      expect(applyCallUpdate([call("a", "ringing")], call("a", status))).toEqual([])
    }
  })

  it("does not duplicate a call it already shows", () => {
    const list = applyCallUpdate([call("a", "ringing")], call("a", "ringing"))
    expect(list).toHaveLength(1)
  })
})

describe("formatCallDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatCallDuration(0)).toBe("0:00")
    expect(formatCallDuration(65)).toBe("1:05")
    expect(formatCallDuration(3723)).toBe("1:02:03")
  })
})

describe("callerLabel", () => {
  it("prefers the WhatsApp name, else the number", () => {
    expect(callerLabel({ customerName: " Asha ", customerWaId: "91" })).toBe("Asha")
    expect(callerLabel({ customerName: null, customerWaId: "919876543210" })).toBe("+919876543210")
  })
})

describe("waitForIceGathering", () => {
  it("resolves straight away when gathering is already complete", async () => {
    const pc = {
      iceGatheringState: "complete",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Parameters<typeof waitForIceGathering>[0]
    await waitForIceGathering(pc)
    expect(pc.addEventListener).not.toHaveBeenCalled()
  })

  // Answering late loses the call; a few late candidates are worth less.
  it("gives up waiting after the timeout", async () => {
    vi.useFakeTimers()
    const pc = {
      iceGatheringState: "gathering",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Parameters<typeof waitForIceGathering>[0]
    const done = waitForIceGathering(pc, 1000)
    vi.advanceTimersByTime(1000)
    await expect(done).resolves.toBeUndefined()
    expect(pc.removeEventListener).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
