/**
 * Earpiece / speaker / headset for calls on Android phones.
 *
 * Chrome on Android doesn't let a page pick an audio *output* (`setSinkId`
 * isn't supported there and only "default" is listed). Instead, output
 * follows the *microphone*: opening a mic with a given device id makes Chrome
 * set Android's communication device, which routes the call audio both ways.
 * Chromium lists those communication devices as microphones under fixed,
 * synthetic names — the ones matched below — and, with nothing chosen, picks
 * wired headset, then USB, then Bluetooth, then the loudspeaker. Never the
 * earpiece, which is why an unmanaged call always played on speaker.
 *
 * The names only ever appear on Android, so desktop browsers get no routes
 * and keep their own output picker.
 */

export type CallRoute = "earpiece" | "speaker" | "wired" | "usb" | "bluetooth"

export interface RouteOption {
  route: CallRoute
  /** The *microphone* device id that selects this route. */
  deviceId: string
  label: string
}

const ROUTE_NAMES: Array<[CallRoute, RegExp, string]> = [
  ["earpiece", /^headset earpiece$/i, "Phone"],
  ["speaker", /^speakerphone$/i, "Speaker"],
  ["wired", /^wired headset$/i, "Wired headphones"],
  ["usb", /^usb audio$/i, "USB audio"],
  ["bluetooth", /^bluetooth headset$/i, "Bluetooth"],
]

/** Routes offered by this browser, or [] when it isn't Chrome on Android. */
export function routesFrom(devices: readonly Pick<MediaDeviceInfo, "kind" | "deviceId" | "label">[]): RouteOption[] {
  const routes: RouteOption[] = []
  for (const [route, pattern, label] of ROUTE_NAMES) {
    const device = devices.find((d) => d.kind === "audioinput" && pattern.test(d.label.trim()))
    if (device?.deviceId && !routes.some((r) => r.route === route)) {
      routes.push({ route, deviceId: device.deviceId, label })
    }
  }
  // Earpiece and speaker are both built in; if either is missing this isn't
  // the Android list at all.
  const builtIn = routes.filter((r) => r.route === "earpiece" || r.route === "speaker")
  return builtIn.length === 2 ? routes : []
}

const EXTERNAL_ORDER: CallRoute[] = ["wired", "usb", "bluetooth"]

/**
 * Where a call should start: on headphones when any are connected (the same
 * order Chrome itself uses), otherwise at the ear, like a phone call.
 */
export function defaultRoute(routes: readonly RouteOption[]): RouteOption | null {
  for (const route of EXTERNAL_ORDER) {
    const found = routes.find((r) => r.route === route)
    if (found) return found
  }
  return routes.find((r) => r.route === "earpiece") ?? null
}

/** A headset that wasn't in `before` — plugged in or paired mid-call. */
export function newlyConnected(
  before: readonly RouteOption[],
  after: readonly RouteOption[],
): RouteOption | null {
  const added = after.filter((r) => EXTERNAL_ORDER.includes(r.route) && !before.some((b) => b.route === r.route))
  return defaultRoute(added)
}
