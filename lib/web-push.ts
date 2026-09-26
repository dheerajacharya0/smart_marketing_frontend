/**
 * Web Push for incoming messages — the part that works with the tab closed.
 *
 * Desktop notifications (lib/desktop-notification.ts) are raised by the page
 * from a socket frame, so they die with the tab. A phone suspends a background
 * tab within seconds, and iOS never lets a page raise one at all. Push is sent
 * by our backend through the browser vendor's push service and shown by the
 * service worker (public/sw.js), so it arrives regardless.
 *
 * iPhone/iPad only support it for a site added to the Home Screen and opened
 * from there (iOS 16.4+); in a Safari tab `PushManager` doesn't exist. That is
 * reported as its own state so the UI can say how to fix it rather than just
 * "unsupported".
 */

import {
  deletePushSubscription,
  getVapidPublicKey,
  savePushSubscription,
} from "@/services/api"
import { setPushActive } from "@/lib/push-state"

export type PushSupport = "supported" | "unsupported" | "ios-needs-install"

const SW_URL = "/sw.js"

function isIos(): boolean {
  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as a Mac; the touch points give it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported"
  const capable =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  if (capable) return "supported"
  if (isIos() && !isStandalone()) return "ios-needs-install"
  return "unsupported"
}

/** VAPID keys travel as unpadded base64url; PushManager wants the raw bytes. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false
  const x = new Uint8Array(a)
  return x.length === b.length && x.every((v, i) => v === b[i])
}

async function existingSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null
  const reg = await navigator.serviceWorker.getRegistration("/")
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Whether this browser is subscribed right now. */
export async function isSubscribed(): Promise<boolean> {
  return (await existingSubscription()) !== null
}

function toBody(sub: PushSubscription) {
  const json = sub.toJSON()
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    userAgent: navigator.userAgent.slice(0, 256),
  }
}

export class PushNotConfiguredError extends Error {
  constructor() {
    super("Push notifications aren't set up on the server yet.")
  }
}

/**
 * Subscribe this browser and register it with the backend. Must run from a
 * click: the permission prompt (and iOS's, always) requires a user gesture.
 * Returns the permission state so the caller can explain a denial.
 */
export async function enablePush(): Promise<NotificationPermission> {
  if (pushSupport() !== "supported") return "denied"

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission
  if (permission !== "granted") return permission

  const publicKey = await getVapidPublicKey()
  if (!publicKey) throw new PushNotConfiguredError()
  const applicationServerKey = urlBase64ToUint8Array(publicKey)

  await navigator.serviceWorker.register(SW_URL, { scope: "/" })
  const reg = await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  // A subscription made under an old server key can't receive from the new
  // one, and subscribe() with a different key throws — drop it first.
  if (sub && !sameKey(sub.options.applicationServerKey, applicationServerKey)) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })

  await savePushSubscription(toBody(sub))
  setPushActive(true)
  return permission
}

/** Unsubscribe this browser and tell the backend. Best effort on the server half. */
export async function disablePush(): Promise<void> {
  const sub = await existingSubscription()
  setPushActive(false)
  if (!sub) return
  try {
    await deletePushSubscription(sub.endpoint)
  } catch {
    // The server prunes dead endpoints itself on the next 404/410.
  }
  await sub.unsubscribe()
}

/**
 * Re-send this browser's subscription on app load. The endpoint can rotate
 * under us (the browser renews it), and the server re-points an endpoint to
 * whoever is signed in — so after a sign-in on a shared device, this is what
 * moves it to the right person. Silent on every failure.
 */
export async function resyncPush(): Promise<void> {
  try {
    let sub = await existingSubscription()
    setPushActive(sub !== null)
    if (!sub) return

    // A subscription is bound to the server key it was made with. If that key
    // changed, the old one gets a 403 on every push forever — replace it here
    // so a key change heals on the next load instead of needing every user to
    // switch notifications off and on.
    const publicKey = await getVapidPublicKey()
    if (publicKey) {
      const applicationServerKey = urlBase64ToUint8Array(publicKey)
      if (!sameKey(sub.options.applicationServerKey, applicationServerKey)) {
        const stale = sub.endpoint
        await sub.unsubscribe()
        await deletePushSubscription(stale).catch(() => undefined)
        const reg = await navigator.serviceWorker.ready
        try {
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
        } catch {
          // Some browsers only allow subscribe() from a click. Report off so the
          // switch shows the truth and the user can turn it back on.
          setPushActive(false)
          return
        }
      }
    }
    await savePushSubscription(toBody(sub))
  } catch {
    // Offline or signed out; the next load tries again.
  }
}
