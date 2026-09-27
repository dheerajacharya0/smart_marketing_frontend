/**
 * Plain-English reads for the numbers that have no benchmark.
 *
 * `lib/benchmarks.ts` scores delivery, read and failure rates against a bar,
 * because for those a bar is defensible. The figures here have none — there is
 * no industry number for "what share of drip enrolments should stop early", and
 * inventing one would be fabrication dressed as guidance.
 *
 * What these do instead is say what the mix *means*: which of these numbers is
 * the good one, which is the system working as intended rather than failing,
 * and what a reader should do about the one that isn't. Each returns null when
 * there is nothing worth saying — a healthy screen gets silence, not praise.
 */

/** Below this, a percentage is arithmetic over too few rows to describe. */
const MIN_ROWS_TO_DESCRIBE = 10

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

// ---- Drip enrolments ------------------------------------------------------

export interface EnrollmentMix {
  active: number
  completed: number
  cancelled: number
  stopped: number
}

/**
 * What the enrolment tiles add up to.
 *
 * The point of this one is `stopped`, which reads like a failure and is not: a
 * stop is an exit condition firing, which means the sequence noticed a reply or
 * a tag change and got out of the way. Someone looking at a quarter of their
 * enrolments "stopped" should know that is the feature working before they go
 * looking for a bug.
 */
export function describeEnrollmentMix(mix: EnrollmentMix): string | null {
  const finished = mix.completed + mix.cancelled + mix.stopped
  const total = finished + mix.active
  if (total < MIN_ROWS_TO_DESCRIBE) return null

  if (finished === 0) {
    return `All ${total.toLocaleString()} enrolments are still mid-sequence — nobody has reached the last step yet.`
  }

  const parts: string[] = [`${pct(mix.completed, finished)}% received every step`]

  if (mix.stopped > 0) {
    parts.push(
      `${pct(mix.stopped, finished)}% stopped early, which is a stop condition firing — the sequence noticing a reply or a tag change, not a failure`,
    )
  }
  if (mix.cancelled > 0) {
    parts.push(`${pct(mix.cancelled, finished)}% were cancelled by hand`)
  }

  const list =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`

  return `Of the ${finished.toLocaleString()} enrolments that have ended, ${list}.`
}

// ---- Revenue --------------------------------------------------------------

export interface RevenueSplit {
  conversions: number
  attributedConversions: number
  revenue: number
  attributedRevenue: number
}

/**
 * How much of the reported revenue messaging is credited with.
 *
 * Deliberately not phrased as revenue messaging *caused*. Attribution is
 * last-touch inside the account's window — a rule for assigning credit, and someone
 * who would have bought anyway still lands in the attributed column. The read
 * says which figure is which and leaves the causal claim unmade.
 */
export function describeRevenueSplit(split: RevenueSplit, windowDays = 7): string | null {
  const window = `${windowDays}-day window`
  if (split.conversions === 0) return null

  if (split.attributedConversions === 0) {
    return `None of these sales fall inside the ${window} after a message, so none are credited to one. Reported revenue still counts — it just arrived some other way.`
  }

  const sharePct = pct(split.attributedRevenue, split.revenue)
  const rest = split.conversions - split.attributedConversions

  if (rest === 0) {
    return `Every reported sale falls inside the ${window} after a message, so all of it is credited to one. Credit is last touch, not proof the message caused the sale.`
  }

  return `${sharePct}% of reported revenue is credited to a message — ${split.attributedConversions.toLocaleString()} of ${split.conversions.toLocaleString()} sales fell inside the ${window} after one. Credit is last touch, not proof the message caused the sale.`
}

// ---- API usage ------------------------------------------------------------

export interface ApiHealth {
  totalRequests: number
  errors: number
  rateLimited: number
}

/**
 * Errors and throttling on the customer's own integration.
 *
 * Silent when both are zero: "no errors" is not news. Throttling is called out
 * separately from errors because it is the one number with an obvious lever —
 * a throttled call was refused for pace, not for being wrong.
 */
export function describeApiHealth({
  totalRequests,
  errors,
  rateLimited,
}: ApiHealth): string | null {
  if (totalRequests === 0) return null
  if (errors === 0 && rateLimited === 0) return null

  const sentences: string[] = []

  if (errors > 0) {
    sentences.push(
      `${pct(errors, totalRequests)}% of calls failed (${errors.toLocaleString()} of ${totalRequests.toLocaleString()}). These are your systems' calls, so the fix is at their end — check the response body for what was rejected.`,
    )
  }

  if (rateLimited > 0) {
    sentences.push(
      `${rateLimited.toLocaleString()} ${rateLimited === 1 ? "call was" : "calls were"} throttled: refused for pace, not for being wrong. Raise the key's tier or spread the calls out, and retry them — a throttled call never reached anything.`,
    )
  }

  return sentences.join(" ")
}
