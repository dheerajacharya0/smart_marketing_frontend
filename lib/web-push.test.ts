import { afterEach, describe, expect, it, vi } from "vitest"
import { pushSupport, urlBase64ToUint8Array } from "./web-push"

vi.mock("@/services/api", () => ({
  deletePushSubscription: vi.fn(),
  getVapidPublicKey: vi.fn(),
  savePushSubscription: vi.fn(),
}))

afterEach(() => vi.unstubAllGlobals())

describe("urlBase64ToUint8Array", () => {
  it("decodes unpadded base64url, including - and _", () => {
    // bytes 0xfb 0xff 0xbf -> base64 "+/+/" -> base64url "-_-_"
    expect(Array.from(urlBase64ToUint8Array("-_-_"))).toEqual([0xfb, 0xff, 0xbf])
  })

  it("restores the padding a VAPID key is sent without", () => {
    expect(Array.from(urlBase64ToUint8Array("AQI"))).toEqual([1, 2])
    expect(Array.from(urlBase64ToUint8Array("AQ"))).toEqual([1])
  })

  it("a 65-byte uncompressed P-256 key survives the round trip", () => {
    const bytes = new Uint8Array(65).map((_, i) => (i * 37) & 0xff)
    bytes[0] = 4
    const b64url = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
    expect(Array.from(urlBase64ToUint8Array(b64url))).toEqual(Array.from(bytes))
  })
})

describe("pushSupport", () => {
  function stubBrowser({
    ua,
    push,
    standalone = false,
    touch = 0,
  }: {
    ua: string
    push: boolean
    standalone?: boolean
    touch?: number
  }) {
    const nav: Record<string, unknown> = { userAgent: ua, maxTouchPoints: touch, standalone }
    if (push) nav.serviceWorker = {}
    vi.stubGlobal("navigator", nav)
    vi.stubGlobal("window", {
      ...(push ? { PushManager: class {}, Notification: class {} } : {}),
      matchMedia: () => ({ matches: standalone }),
    })
  }

  it("supported when the browser has service workers and PushManager", () => {
    stubBrowser({ ua: "Mozilla/5.0 (Linux; Android 14) Chrome/128", push: true })
    expect(pushSupport()).toBe("supported")
  })

  it("an iPhone in a Safari tab is told to install, not told it's unsupported", () => {
    stubBrowser({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)", push: false })
    expect(pushSupport()).toBe("ios-needs-install")
  })

  it("an iPad reporting itself as a Mac is still recognised", () => {
    stubBrowser({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", push: false, touch: 5 })
    expect(pushSupport()).toBe("ios-needs-install")
  })

  it("an installed iOS app without push (older iOS) is plainly unsupported", () => {
    stubBrowser({
      ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
      push: false,
      standalone: true,
    })
    expect(pushSupport()).toBe("unsupported")
  })
})
