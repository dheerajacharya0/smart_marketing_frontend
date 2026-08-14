/**
 * Rate benchmarks and plain-language interpretation.
 *
 * A percentage on its own tells a first-time sender nothing: is a 62% read rate
 * good? Is a 4% failure rate a problem? The dashboard already coloured a couple
 * of tiles green/amber with thresholds inlined at the call site, and one hint
 * string ("good is 60%+") hardcoded next to it. This centralises the thresholds
 * and adds the part that actually helps — what the number means and what to do
 * about it.
 *
 * **On where the numbers come from — read before changing them.** These are
 * rules of thumb chosen to be useful for orientation, not measured industry
 * averages, and the UI says so. We have no benchmark dataset, and inventing
 * precise figures ("the industry average is 63.2%") to lend them authority
 * would be fabrication. What each threshold *is* grounded in:
 *
 * - **Delivery** — undelivered almost always means a wrong number, an inactive
 *   WhatsApp account, or a block. On a clean list this should be near-total, so
 *   anything under ~90% points at list quality rather than message quality.
 * - **Failure** — Meta treats send failures as a quality signal, and a rising
 *   failure rate is one of the things that gets a number flagged. Any sustained
 *   failure rate deserves a look; a few percent is the point to act.
 * - **Read** — WhatsApp read rates run far above email because messages land in
 *   the same app people use with friends. The bar is set high because a *low*
 *   read rate here is meaningful in a way a low email open rate isn't.
 * - **Reply** — deliberately has no "good" bar. Reply rate depends entirely on
 *   whether the message asked for a reply; scoring an order-confirmation blast
 *   against a conversational campaign would be noise dressed as insight.
 */

export type Verdict = "good" | "ok" | "poor" | "none"

export interface RateBenchmark {
  key: "delivery" | "read" | "reply" | "failure"
  label: string
  /** Short benchmark shown next to the number, e.g. "healthy is 90%+". */
  benchmark?: string
  /** One line on what this verdict means and what to do next. */
  interpret: (verdict: Verdict) => string | undefined
  /** Verdict for a 0-100 percentage. */
  verdict: (rate: number) => Verdict
}

/** Higher is better: at or above `good` is good, at or above `ok` is ok. */
function ascending(good: number, ok: number) {
  return (rate: number): Verdict => {
    if (!Number.isFinite(rate)) return "none"
    if (rate >= good) return "good"
    if (rate >= ok) return "ok"
    return "poor"
  }
}

export const DELIVERY_BENCHMARK: RateBenchmark = {
  key: "delivery",
  label: "Delivery rate",
  benchmark: "healthy is 90%+",
  verdict: ascending(90, 70),
  interpret: (verdict) => {
    switch (verdict) {
      case "good":
        return "Your list is reaching real, active WhatsApp numbers."
      case "ok":
        return "Some numbers aren't receiving. Usually stale entries in your contact list rather than anything wrong with the message."
      case "poor":
        return "A lot of messages aren't arriving. Check your contacts for wrong or inactive numbers — sending to dead numbers also drags your quality rating down."
      default:
        return undefined
    }
  },
}

export const READ_BENCHMARK: RateBenchmark = {
  key: "read",
  label: "Read rate",
  benchmark: "healthy is 60%+",
  verdict: ascending(60, 40),
  interpret: (verdict) => {
    switch (verdict) {
      case "good":
        return "People are opening what you send. Keep the sending pattern you have."
      case "ok":
        return "Middling. Try sending at a different time of day, or opening with something more specific to the person."
      case "poor":
        return "Most people aren't opening these. That usually means the audience didn't expect to hear from you — narrow the segment to people who've engaged before."
      default:
        return undefined
    }
  },
}

/**
 * No thresholds on purpose — see the module note. Reply rate is only meaningful
 * against a message that asked for a reply, and we can't tell which did.
 */
export const REPLY_BENCHMARK: RateBenchmark = {
  key: "reply",
  label: "Reply rate",
  verdict: () => "none",
  interpret: () => undefined,
}

export const FAILURE_BENCHMARK: RateBenchmark = {
  key: "failure",
  label: "Failure rate",
  benchmark: "keep under 2%",
  verdict: (rate) => {
    if (!Number.isFinite(rate)) return "none"
    if (rate >= 5) return "poor"
    if (rate >= 2) return "ok"
    return "good"
  },
  interpret: (verdict) => {
    switch (verdict) {
      case "good":
        return undefined // Nothing to say when nothing is wrong.
      case "ok":
        return "Some sends are failing. Check a failed recipient for the specific Meta error — it's usually an invalid number or an expired template."
      case "poor":
        return "Failures are high enough to put your number's quality rating at risk. Open a failed recipient to see Meta's error before sending again."
      default:
        return undefined
    }
  },
}

export const RATE_BENCHMARKS = {
  delivery: DELIVERY_BENCHMARK,
  read: READ_BENCHMARK,
  reply: REPLY_BENCHMARK,
  failure: FAILURE_BENCHMARK,
} as const

/** Tile tone for a verdict. `poor` on failure is a danger, not a soft warning. */
export function verdictTone(
  benchmark: RateBenchmark,
  verdict: Verdict
): "success" | "warning" | "danger" | "default" {
  if (verdict === "none") return "default"
  if (benchmark.key === "failure") {
    if (verdict === "poor") return "danger"
    if (verdict === "ok") return "warning"
    return "default" // A low failure rate is normal, not an achievement.
  }
  if (verdict === "good") return "success"
  if (verdict === "ok") return "warning"
  return "default"
}

/**
 * "62% read rate · healthy is 60%+" — the hint line under a stat tile.
 * Omits the benchmark when the rate isn't scored (reply rate).
 */
export function rateHint(benchmark: RateBenchmark, rate: number): string {
  const base = `${rate}% ${benchmark.label.toLowerCase()}`
  return benchmark.benchmark ? `${base} · ${benchmark.benchmark}` : base
}
