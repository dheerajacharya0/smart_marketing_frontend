/**
 * Whether this browser currently holds a push subscription we registered.
 *
 * A hint, not the truth — the truth is `pushManager.getSubscription()`, which is
 * async. This exists for two synchronous callers: the socket handler, which must
 * not raise its own notification when the service worker will raise one for the
 * same message, and sign-out, which must know whether there is anything to tear
 * down. Kept free of imports so services/api.ts can use it without a cycle.
 */

const PUSH_ACTIVE_KEY = "push-notifications-active"

export function isPushActive(): boolean {
  try {
    return window.localStorage.getItem(PUSH_ACTIVE_KEY) === "1"
  } catch {
    return false
  }
}

export function setPushActive(active: boolean): void {
  try {
    if (active) window.localStorage.setItem(PUSH_ACTIVE_KEY, "1")
    else window.localStorage.removeItem(PUSH_ACTIVE_KEY)
  } catch {
    // Best effort; the only cost is a possible duplicate notification.
  }
}
