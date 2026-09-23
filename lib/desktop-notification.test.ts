// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { isEnabled, previewOf, setEnabled, shouldNotify } from "@/lib/desktop-notification"

/**
 * jsdom has no Notification API, so what is pinned here is every rule decided
 * before one would be raised. The background-only rule is the one that makes
 * the difference between a useful feature and one people disable on day one.
 */

const GRANTED = { enabled: true, permission: "granted" as const, appFocused: false, direction: "inbound" }

beforeEach(() => {
  window.localStorage.clear()
})

describe("opt-in preference", () => {
  it("is off until explicitly turned on", () => {
    expect(isEnabled()).toBe(false)
  })

  it("round-trips", () => {
    setEnabled(true)
    expect(isEnabled()).toBe(true)
    setEnabled(false)
    expect(isEnabled()).toBe(false)
  })

  it("reads as off rather than throwing when storage is blocked", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    expect(isEnabled()).toBe(false)
  })
})

describe("shouldNotify", () => {
  it("notifies for an inbound message while the app is not focused", () => {
    expect(shouldNotify(GRANTED)).toBe(true)
  })

  it("stays quiet while the user is looking at the app", () => {
    // The badge and the tone have already said it; a popup for a message you
    // are watching arrive is pure noise.
    expect(shouldNotify({ ...GRANTED, appFocused: true })).toBe(false)
  })

  it("notifies when the window is visible but unfocused", () => {
    // The case that broke it in practice. Keying off `document.hidden` alone
    // treated a browser sitting in plain sight — while the user types on their
    // phone — as "watching the inbox", so nothing ever fired.
    expect(shouldNotify({ ...GRANTED, appFocused: false })).toBe(true)
  })

  it("stays quiet when not opted in", () => {
    expect(shouldNotify({ ...GRANTED, enabled: false })).toBe(false)
  })

  it.each(["default", "denied", "unsupported"] as const)(
    "stays quiet when permission is %s",
    (permission) => {
      expect(shouldNotify({ ...GRANTED, permission })).toBe(false)
    },
  )

  it("ignores your own message echoed back from another device", () => {
    expect(shouldNotify({ ...GRANTED, direction: "outbound" })).toBe(false)
  })

  it("ignores a delivery-status frame", () => {
    expect(shouldNotify({ ...GRANTED, direction: "status" })).toBe(false)
    expect(shouldNotify({ ...GRANTED, direction: undefined })).toBe(false)
  })
})

describe("previewOf", () => {
  it("collapses whitespace so a pasted block stays one line", () => {
    expect(previewOf("hello\n\n  there   friend")).toBe("hello there friend")
  })

  it("truncates with an ellipsis", () => {
    expect(previewOf("x".repeat(200))).toHaveLength(120)
    expect(previewOf("x".repeat(200)).endsWith("…")).toBe(true)
  })

  it("keeps a message that already fits untouched", () => {
    expect(previewOf("Is this still available?")).toBe("Is this still available?")
  })

  it("describes a message with no text rather than showing an empty body", () => {
    // An image or a sticker has no preview text, and a blank notification body
    // reads as a bug.
    expect(previewOf("")).toBe("Sent you a message")
    expect(previewOf(null)).toBe("Sent you a message")
    expect(previewOf("   ")).toBe("Sent you a message")
  })
})
