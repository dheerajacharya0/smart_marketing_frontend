/**
 * Watches the wallet until a top-up's credit lands, independently of whatever
 * UI started the watch.
 *
 * The credit arrives by Razorpay webhook, not from the browser, so the only way
 * to see it is to re-read the balance until it moves. That used to live inside
 * the top-up dialog, which made two things wrong: closing the dialog while it
 * said "Confirming…" cancelled the poll, and after ~30s it gave up while telling
 * the user the page "refreshes on its own". Either way the sidebar and billing
 * card showed the old balance until a full reload.
 *
 * Owning the loop here, keyed per account, means the dialog can come and go and
 * the shared wallet cache still gets the new balance when it lands.
 */

export interface CreditWatchOptions<W extends { balanceMicros: string }> {
  fetchWallet: () => Promise<W>
  /** `balanceMicros` read before payment; any change means the credit landed. */
  baselineMicros: string
  onCredited: (wallet: W) => void
  /** Called once when the fast phase ends without a credit. */
  onSlow?: () => void
  /** Called once if the watch ends without seeing a credit. */
  onGiveUp?: () => void
}

/** Fast checks while a webhook normally lands, then slower ones for stragglers. */
export const FAST_INTERVAL_MS = 2000
export const FAST_PHASE_MS = 30_000
export const SLOW_INTERVAL_MS = 5000
export const WATCH_LIMIT_MS = 5 * 60_000

const active = new Map<string, () => void>()

/**
 * Start watching `key` (the account id). A second watch for the same key
 * replaces the first — the newest baseline is the right one to compare against.
 * Returns a cancel function.
 */
export function startCreditWatch<W extends { balanceMicros: string }>(
  key: string,
  opts: CreditWatchOptions<W>
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
      const wallet = await opts.fetchWallet()
      if (stopped) return
      if (wallet.balanceMicros !== opts.baselineMicros) {
        stop()
        opts.onCredited(wallet)
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
