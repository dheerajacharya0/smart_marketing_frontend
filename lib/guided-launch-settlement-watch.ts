/**
 * Watches the Guided Launch order until it settles to `paid`, independently
 * of whatever UI started the watch.
 *
 * Same reasoning as wallet-credit-watch.ts / subscription-activation-watch.ts:
 * Checkout's success handler only means "the gateway accepted the payment" —
 * only the Razorpay webhook flips status off `created`. A separate file
 * rather than generalizing one of the other two watchers: each is typed
 * around a different shape, and forcing a third through either costs more
 * than the handful of duplicated lines here do.
 */

export interface GuidedLaunchWatchOptions<L extends { status: string }> {
  fetchGuidedLaunch: () => Promise<L | null>
  onSettled: (launch: L) => void
  /** Called once when the fast phase ends without settling. */
  onSlow?: () => void
  /** Called once if the watch ends without seeing it settle. */
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
export function startGuidedLaunchSettlementWatch<L extends { status: string }>(
  key: string,
  opts: GuidedLaunchWatchOptions<L>
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
      const launch = await opts.fetchGuidedLaunch()
      if (stopped) return
      if (launch && launch.status !== "created") {
        stop()
        opts.onSettled(launch)
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
