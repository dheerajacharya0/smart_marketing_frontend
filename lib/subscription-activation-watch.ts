/**
 * Watches the subscription until it actually activates, independently of
 * whatever UI started the watch.
 *
 * Same reasoning as wallet-credit-watch.ts: Razorpay Checkout's success
 * handler only means "the gateway accepted the mandate", not "entitlements
 * changed" — only the `subscription.activated` webhook flips `account.plan`.
 * The only way to see that from the browser is to re-read GET
 * /billing/subscription until its status moves off `created`.
 *
 * A separate file rather than generalizing wallet-credit-watch.ts: that one is
 * typed around `balanceMicros` specifically, and forcing a second shape
 * through the same function would cost more than the few duplicated lines
 * here do.
 */

export interface SubscriptionWatchOptions<S extends { status: string }> {
  fetchSubscription: () => Promise<S | null>
  onActivated: (subscription: S) => void
  /** Called once when the fast phase ends without activation. */
  onSlow?: () => void
  /** Called once if the watch ends without seeing activation. */
  onGiveUp?: () => void
}

export const FAST_INTERVAL_MS = 2000
export const FAST_PHASE_MS = 30_000
export const SLOW_INTERVAL_MS = 5000
export const WATCH_LIMIT_MS = 5 * 60_000

const active = new Map<string, () => void>()

/**
 * Start watching `key` (the account id). A second watch for the same key
 * replaces the first. Returns a cancel function.
 */
export function startSubscriptionActivationWatch<S extends { status: string }>(
  key: string,
  opts: SubscriptionWatchOptions<S>
): () => void {
  active.get(key)?.()

  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let elapsed = 0
  let slowNotified = false

  const stop = () => {
    stopped = true
    if (timer) clearTimeout(timer)
    if (active.get(key) === stop) active.delete(key)
  }

  const tick = async () => {
    if (stopped) return
    try {
      const subscription = await opts.fetchSubscription()
      if (stopped) return
      if (subscription && subscription.status === "active") {
        stop()
        opts.onActivated(subscription)
        return
      }
    } catch {
      // A transient read failure is not a verdict; the webhook is what matters.
    }
    if (stopped) return
    if (!slowNotified && elapsed >= FAST_PHASE_MS) {
      slowNotified = true
      opts.onSlow?.()
    }
    if (elapsed >= WATCH_LIMIT_MS) {
      stop()
      opts.onGiveUp?.()
      return
    }
    schedule()
  }

  const schedule = () => {
    const interval = elapsed < FAST_PHASE_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS
    elapsed += interval
    timer = setTimeout(() => void tick(), interval)
  }

  active.set(key, stop)
  schedule()
  return stop
}
