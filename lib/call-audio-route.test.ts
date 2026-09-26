import { describe, expect, it } from "vitest"
import { defaultRoute, newlyConnected, routesFrom } from "./call-audio-route"

const mic = (deviceId: string, label: string) => ({ kind: "audioinput" as MediaDeviceKind, deviceId, label })

const android = [mic("default", "Default"), mic("a1", "Speakerphone"), mic("a2", "Headset earpiece")]

describe("routesFrom", () => {
  it("reads Chrome on Android's synthetic communication devices", () => {
    expect(routesFrom(android).map((r) => r.route)).toEqual(["earpiece", "speaker"])
    expect(routesFrom(android)[0]).toEqual({ route: "earpiece", deviceId: "a2", label: "Phone" })
  })

  it("offers nothing on a desktop", () => {
    expect(routesFrom([mic("default", "Default - Microphone (Realtek)"), mic("x", "Headset Microphone (Jabra)")])).toEqual([])
  })

  it("ignores devices whose labels are hidden (no mic permission yet)", () => {
    expect(routesFrom([mic("", ""), mic("", "")])).toEqual([])
  })
})

describe("defaultRoute", () => {
  it("starts at the ear with nothing connected", () => {
    expect(defaultRoute(routesFrom(android))?.route).toBe("earpiece")
  })

  it("prefers headphones, in Chrome's own order", () => {
    const routes = routesFrom([...android, mic("b", "Bluetooth headset"), mic("w", "Wired headset")])
    expect(defaultRoute(routes)?.route).toBe("wired")
  })
})

describe("newlyConnected", () => {
  it("spots a headset that arrived mid-call", () => {
    const before = routesFrom(android)
    const after = routesFrom([...android, mic("b", "Bluetooth headset")])
    expect(newlyConnected(before, after)?.route).toBe("bluetooth")
    expect(newlyConnected(after, after)).toBeNull()
  })
})
