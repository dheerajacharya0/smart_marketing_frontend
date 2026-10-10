/**
 * One contextual, plain-language suggestion per screen.
 *
 * A dashboard full of correct numbers still leaves "so what should I do?"
 * unanswered. These rules read what a screen already loaded and, at most once,
 * say the one thing worth acting on — "412 of your contacts have no opt-in
 * recorded, so nothing can be sent to them" — with the link that fixes it.
 *
 * Rules for adding one, in the order they matter:
 *
 * 1. **At most one.** A stack of banners is a second navigation menu. Rules are
 *    ordered by consequence and the first that fires wins; everything below it
 *    stays quiet until that one is dealt with.
 * 2. **Only when it's actionable.** "Your delivery rate is 97%" is a compliment,
 *    not an insight. If there is nothing to do about it, say nothing.
 * 3. **Clear a materiality bar.** Percentages over tiny denominators are noise:
 *    one failure out of three sends is not a 33% failure rate worth a banner.
 *    Every rule here carries a minimum count for that reason.
 * 4. **Nothing expensive.** A rule reads what its screen already has, or at
 *    most a count query (`limit: 1`, read `total`) it can fire once per
 *    account. A nudge that costs a page of data is a feature, not a nudge.
 * 5. **Never invented.** Nothing here estimates, extrapolates, or asserts a
 *    cause. The rule states what the data says and what to do about it.
 */

import { FAILURE_BENCHMARK } from "@/lib/benchmarks"

export type InsightTone = "info" | "warning"

export interface Insight {
  /**
   * Stable across renders and across sessions — dismissal is stored under it.
   * Name the *condition*, not the numbers in it, or a dismissed banner comes
   * back the moment a count ticks by one.
   */
  id: string
  tone: InsightTone
  /** One sentence, plain language, no jargon that isn't on screen already. */
  message: string
  action?: { label: string; href: string }
}

// ---- Materiality bars -----------------------------------------------------

/** Below this, a rate is arithmetic on too few events to mean anything. */
const MIN_SENDS_FOR_RATE = 50
/** Below this, a share of a contact list is a handful of rows, not a pattern. */
const MIN_CONTACTS_FOR_SHARE = 20
/** A share this size or larger is worth a sentence. */
const NOTABLE_SHARE = 0.25

function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0
}

function plural(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural
}

// ---- Dashboard ------------------------------------------------------------

/**
 * Deliberately says nothing about delivery, read or failure rates: the
 * dashboard renders `RateInterpretation` directly below this banner, and it
 * already turns those into advice. Two components explaining the same number in
 * different words is worse than one.
 */
export interface DashboardInsightInput {
  recipients?: {
    sentCount: number
    failedCount: number
    skippedCount: number
    totalRecipients: number
  }
  campaigns?: { total: number; byStatus: { paused: number } }
  /** Total contacts on the account, when the screen knows it. */
  contactCount?: number
}

export function dashboardInsight(input: DashboardInsightInput): Insight | null {
  const { recipients, campaigns, contactCount } = input

  // Skipped means the recipient was never eligible — no opt-in, or opted out.
  // It is invisible on the delivery tiles because it never became a send.
  if (
    recipients &&
    recipients.skippedCount > 0 &&
    recipients.totalRecipients >= MIN_CONTACTS_FOR_SHARE &&
    share(recipients.skippedCount, recipients.totalRecipients) >= NOTABLE_SHARE
  ) {
    return {
      id: "skipped-recipients-high",
      tone: "info",
      message: `${recipients.skippedCount.toLocaleString()} of ${recipients.totalRecipients.toLocaleString()} recipients were skipped — they opted out or were deleted before the send, so nothing was sent to them.`,
      action: { label: "Review contacts", href: "/dashboard/contacts" },
    }
  }

  if (campaigns && campaigns.total === 0 && (contactCount ?? 0) >= MIN_CONTACTS_FOR_SHARE) {
    return {
      id: "no-campaigns-yet",
      tone: "info",
      message: `You have ${(contactCount ?? 0).toLocaleString()} contacts and haven't sent a broadcast yet.`,
      action: { label: "Send your first broadcast", href: "/dashboard/campaigns?new=1" },
    }
  }

  if (campaigns && campaigns.byStatus.paused > 0) {
    const count = campaigns.byStatus.paused
    return {
      id: "campaigns-paused",
      tone: "info",
      message: `${count} ${plural(count, "campaign")} ${plural(count, "is", "are")} paused. A paused campaign stays stopped until someone resumes it.`,
      action: { label: "Open campaigns", href: "/dashboard/campaigns" },
    }
  }

  return null
}

// ---- Contacts -------------------------------------------------------------

export interface ContactsInsightInput {
  total: number
  optedInTotal: number | null
  /** Whether any tag exists on the account. Drives the segmenting nudge. */
  hasTags?: boolean
}

export function contactsInsight({
  total,
  optedInTotal,
  hasTags,
}: ContactsInsightInput): Insight | null {
  if (total < MIN_CONTACTS_FOR_SHARE || optedInTotal == null) return null

  const unreachable = Math.max(0, total - optedInTotal)
  if (share(unreachable, total) >= NOTABLE_SHARE && unreachable > 0) {
    return {
      id: "contacts-not-opted-in",
      tone: "warning",
      // No action: the opt-in filter is on this screen, a few pixels away. A
      // link back to the page the banner is on is furniture, not help.
      message: `${unreachable.toLocaleString()} of your ${total.toLocaleString()} contacts have no opt-in recorded. Broadcasts still reach them unless they opted out, but drip sequences don't — record consent you already hold to include them.`,
    }
  }

  // Only worth saying on a list big enough that sending to all of it is the
  // wrong move — which is exactly when tags start to matter.
  if (hasTags === false && total >= MIN_CONTACTS_FOR_SHARE * 5) {
    return {
      id: "contacts-untagged",
      tone: "info",
      message: `None of your ${total.toLocaleString()} contacts are tagged, so every broadcast has to go to all of them. A tag is what lets you send to part of the list.`,
      action: { label: "Build a segment", href: "/dashboard/segments" },
    }
  }

  return null
}

// ---- Campaigns ------------------------------------------------------------

export interface CampaignsInsightInput {
  campaigns: readonly {
    id: string
    name: string
    status: string
    sentCount: number
    failedCount: number
    readCount: number
    repliedCount?: number
    clickedCount?: number
    trackLinks?: boolean
    completedAt: string | null
  }[]
}

export function campaignsInsight({ campaigns }: CampaignsInsightInput): Insight | null {
  const completed = campaigns
    .filter((c) => c.status === "completed" && c.sentCount >= MIN_SENDS_FOR_RATE)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))

  const latest = completed[0]
  if (!latest) return null

  const failureRate = Math.round(share(latest.failedCount, latest.sentCount) * 100)
  if (FAILURE_BENCHMARK.verdict(failureRate) === "poor") {
    return {
      id: "last-campaign-failures",
      tone: "warning",
      message: `${failureRate}% of "${latest.name}" failed to send. Repeated failures are read by Meta as a quality signal, so it is worth finding out why before the next broadcast.`,
      action: { label: "Open campaign", href: `/dashboard/campaigns/${latest.id}` },
    }
  }

  // Link tracking is off by default, and a campaign built around a link with
  // no tracking has no answer to "did anyone click it".
  if (latest.trackLinks === false) {
    return {
      id: "last-campaign-untracked",
      tone: "info",
      message: `"${latest.name}" went out without link tracking, so there is no click count for it. Turning it on when you compose means the next one can be measured.`,
    }
  }

  return null
}

// ---- Drips ----------------------------------------------------------------

export interface DripsInsightInput {
  drips: readonly {
    id: string
    name: string
    isActive: boolean
    exitConditions?: readonly unknown[]
    enrollments?: { active: number }
  }[]
}

export function dripsInsight({ drips }: DripsInsightInput): Insight | null {
  // A sequence switched off while people are still enrolled is the failure that
  // looks like nothing: the enrolments sit there and the next step never sends.
  const stalled = drips.filter((d) => !d.isActive && (d.enrollments?.active ?? 0) > 0)
  if (stalled.length > 0) {
    const held = stalled.reduce((sum, d) => sum + (d.enrollments?.active ?? 0), 0)
    return {
      id: "drips-inactive-with-enrollments",
      tone: "warning",
      message:
        stalled.length === 1
          ? `"${stalled[0].name}" is switched off but still holds ${held.toLocaleString()} active ${plural(held, "enrolment")}. They will not receive another step until it is switched back on.`
          : `${stalled.length} switched-off sequences still hold ${held.toLocaleString()} active ${plural(held, "enrolment")} between them. Those contacts will not receive another step.`,
    }
  }

  // Without an exit condition a sequence keeps sending to someone who already
  // replied — every step after that reply is a charged message with negative
  // value.
  // `Array.isArray` rather than a length check on a possibly-absent field: a
  // list endpoint that omits `exitConditions` would otherwise read as "this
  // sequence has none", and accuse every drip on the screen of a fault it may
  // not have.
  const noExit = drips.filter(
    (d) =>
      d.isActive &&
      Array.isArray(d.exitConditions) &&
      d.exitConditions.length === 0 &&
      (d.enrollments?.active ?? 0) > 0,
  )
  if (noExit.length > 0) {
    return {
      id: "drips-without-exit-conditions",
      tone: "info",
      message:
        noExit.length === 1
          ? `"${noExit[0].name}" has no stop conditions, so it keeps sending on schedule even after someone replies.`
          : `${noExit.length} running sequences have no stop conditions, so they keep sending on schedule even after someone replies.`,
    }
  }

  return null
}
