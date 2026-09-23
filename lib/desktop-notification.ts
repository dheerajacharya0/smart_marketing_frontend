/**
 * System notifications for incoming messages, the way WhatsApp Desktop does it.
 *
 * The rule that makes this tolerable rather than irritating: only notify when
 * the tab is not being looked at. If the inbox is on screen, the unread badge
 * and the tone have already said everything a popup would, and a notification
 * for a message you are watching arrive is pure noise.
 *
 * Permission is never requested on load. A prompt nobody asked for is the one
 * people dismiss forever, and "denied" cannot be undone from script — it has to
 * be cleared in browser settings. So the request only ever happens from a
 * deliberate click on the switch in Settings.
 */

const ENABLED_KEY = "desktop-notifications-enabled"

export type PermissionState = "unsupported" | "default" | "granted" | "denied"

export function isSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

export function permissionState(): PermissionState {
  if (!isSupported()) return "unsupported"
  return Notification.permission as Exclude<PermissionState, "unsupported">
}

/** Opt-in, so an absent preference is off. */
export function isEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === "1"
  } catch {
    return false
  }
}

export function setEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0")
  } catch {
    // Best effort; the caller keeps its own state for this tab.
  }
}

/** Resolves to the state after the prompt, or the current one if it can't ask. */
export async function requestPermission(): Promise<PermissionState> {
  if (!isSupported()) return "unsupported"
  if (Notification.permission !== "default") return permissionState()
  try {
    return (await Notification.requestPermission()) as PermissionState
  } catch {
    return permissionState()
  }
}

/**
 * Whether this message earns a system notification.
 *
 * Pure so the rules can be tested: jsdom has no Notification API, and these
 * four conditions — opted in, permitted, tab not visible, message came from
 * the customer — are the whole feature.
 */
export function shouldNotify({
  enabled,
  permission,
  appFocused,
  direction,
}: {
  enabled: boolean
  permission: PermissionState
  /**
   * Is the user actually looking at this app right now — see `appIsFocused`.
   *
   * Focus, not visibility. `document.hidden` alone was wrong: it is only true
   * when the tab is inactive or the window is minimised, so the commonest case
   * of all — the browser sitting visible on screen while you read your phone —
   * counted as "watching the inbox" and every notification was suppressed.
   */
  appFocused: boolean
  direction: string | undefined
}): boolean {
  if (!enabled) return false
  if (permission !== "granted") return false
  // The one rule that stops this being annoying.
  if (appFocused) return false
  // Your own message, echoed back on the same socket from another device.
  return direction === "inbound"
}

/**
 * Whether the user is looking at this app.
 *
 * Both halves are needed. `document.hidden` catches a background tab or a
 * minimised window; `document.hasFocus()` catches the window sitting in plain
 * sight while the user is in another app — which is exactly what is happening
 * when they are typing on their phone.
 */
export function appIsFocused(): boolean {
  if (typeof document === "undefined") return false
  if (document.hidden) return false
  // Not every environment implements it; assume focused rather than notifying
  // over the top of someone who is reading the inbox.
  return typeof document.hasFocus === "function" ? document.hasFocus() : true
}

/** Trim a preview to something that fits a notification without a scrollbar. */
export function previewOf(text: string | null | undefined, max = 120): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim()
  if (!clean) return "Sent you a message"
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean
}

export interface MessageNotification {
  title: string
  body: string
  /** Conversation id — repeated messages replace rather than stack. */
  tag: string
  /** Where clicking should land. */
  url: string
}

/**
 * Show one notification. Returns whether it was actually raised, so callers can
 * tell "suppressed" from "shown" without reaching into the browser API.
 *
 * Clicking focuses this window and navigates to the thread, which is the only
 * reason a notification is worth having over the tone alone.
 */
export function showMessageNotification(n: MessageNotification): boolean {
  if (!isSupported() || Notification.permission !== "granted") return false
  try {
    const notification = new Notification(n.title, {
      body: n.body,
      tag: n.tag,
      // Replacing a notification for the same thread should not re-alert; the
      // tone already played, and a second buzz per message is the behaviour
      // people turn notifications off over.
      renotify: false,
    } as NotificationOptions)
    notification.onclick = () => {
      try {
        window.focus()
        window.location.href = n.url
      } finally {
        notification.close()
      }
    }
    return true
  } catch {
    // Some browsers throw when constructing outside a service worker.
    return false
  }
}
