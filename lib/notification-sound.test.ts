// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { THROTTLE_MS, isMuted, setMuted, shouldPlay } from "@/lib/notification-sound"

/**
 * The audible part needs a real AudioContext, which jsdom has not got. What is
 * worth pinning is everything decided before a sound is made: whether it is
 * muted, and whether one just played.
 */

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("mute preference", () => {
  it("defaults to unmuted", () => {
    expect(isMuted()).toBe(false)
  })

  it("round-trips through localStorage", () => {
    setMuted(true)
    expect(isMuted()).toBe(true)
    setMuted(false)
    expect(isMuted()).toBe(false)
  })

  it("reports unmuted rather than throwing when storage is blocked", () => {
    // A private window with site data blocked throws on access, and an inbox
    // that crashes is worse than one that dings.
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    expect(isMuted()).toBe(false)
  })

  it("does not throw when the preference cannot be written", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })
    expect(() => setMuted(true)).not.toThrow()
  })
})

describe("shouldPlay", () => {
  it("plays the first tone of a session", () => {
    expect(shouldPlay({ muted: false, now: 1_000, lastPlayedAt: null })).toBe(true)
  })

  it("stays silent when muted, even for the first message", () => {
    expect(shouldPlay({ muted: true, now: 1_000, lastPlayedAt: null })).toBe(false)
  })

  it("mute wins over an expired throttle window", () => {
    expect(shouldPlay({ muted: true, now: 100_000, lastPlayedAt: 1_000 })).toBe(false)
  })

  it("drops a tone inside the throttle window", () => {
    // A campaign reply burst arrives as a dozen frames in a second or two.
    expect(shouldPlay({ muted: false, now: 1_500, lastPlayedAt: 1_000 })).toBe(false)
  })

  it("plays again once the window has passed", () => {
    expect(shouldPlay({ muted: false, now: 1_000 + THROTTLE_MS, lastPlayedAt: 1_000 })).toBe(true)
  })

  it("treats the boundary as elapsed, not as still throttled", () => {
    expect(shouldPlay({ muted: false, now: 2_000, lastPlayedAt: 1_000, throttleMs: 1_000 })).toBe(true)
    expect(shouldPlay({ muted: false, now: 1_999, lastPlayedAt: 1_000, throttleMs: 1_000 })).toBe(false)
  })

  it("collapses a burst to one tone, not one per message", () => {
    const arrivals = [0, 120, 260, 400, 900, 1_400]
    let last: number | null = null
    let played = 0
    for (const t of arrivals) {
      if (shouldPlay({ muted: false, now: t, lastPlayedAt: last })) {
        played += 1
        last = t
      }
    }
    expect(played).toBe(1)
  })
})
