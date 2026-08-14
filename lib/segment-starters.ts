import type { ConditionDraft } from "@/lib/segment-rules"
import { emptyCondition } from "@/lib/segment-rules"

/**
 * Clonable starter segments.
 *
 * Segments start from a blank slate, and the condition builder assumes you
 * already know which of five condition types answers your question. These are
 * the five questions people actually ask, pre-built — you land in the builder
 * with the rules filled in, preview them against your real contacts, and edit
 * or save.
 *
 * Every starter is a normal editable draft, not a special kind of segment:
 * nothing is saved until you press save, and the result is indistinguishable
 * from one built by hand.
 *
 * Constraint worth knowing: a condition may only use an operator that
 * `operatorOptionsFor` offers for its type, or the builder renders a Select
 * holding a value absent from its own option list. `ConditionDraft` types
 * `operator` as a plain string, so this is not checked by the compiler — verify
 * new starters against `operatorOptionsFor` in `lib/segment-rules.ts` by hand.
 */

export interface SegmentStarter {
  id: string
  label: string
  /** One line on the card — what this segment is for, not what it does. */
  blurb: string
  name: string
  description: string
  combinator: "and" | "or"
  conditions: ConditionDraft[]
}

/** Fills the unused fields so every draft stays a controlled input. */
function condition(patch: Partial<ConditionDraft>): ConditionDraft {
  return { ...emptyCondition(), ...patch }
}

export const SEGMENT_STARTERS: SegmentStarter[] = [
  {
    id: "recently-active",
    label: "Recently active",
    blurb: "People who've messaged you in the last 30 days.",
    name: "Recently active",
    description: "Contacts with conversation activity in the last 30 days.",
    combinator: "and",
    conditions: [
      condition({ type: "activity", operator: "active_within", days: "30" }),
      condition({ type: "field", field: "optedIn", operator: "is_true" }),
    ],
  },
  {
    id: "gone-quiet",
    label: "Gone quiet",
    blurb: "Opted-in people you haven't heard from in 90 days — a win-back audience.",
    name: "Gone quiet (90 days)",
    description: "Opted-in contacts with no conversation activity for 90 days.",
    combinator: "and",
    conditions: [
      condition({ type: "activity", operator: "inactive_within", days: "90" }),
      condition({ type: "field", field: "optedIn", operator: "is_true" }),
    ],
  },
  {
    id: "engaged-with-campaigns",
    label: "Engaged with campaigns",
    blurb: "People who read a campaign in the last 60 days. Your warmest audience.",
    name: "Campaign readers",
    description: "Contacts who read any campaign message in the last 60 days.",
    combinator: "and",
    conditions: [
      condition({ type: "campaign", event: "read", operator: "within", days: "60" }),
    ],
  },
  {
    id: "never-replied",
    label: "Never replied",
    blurb: "Received a campaign in the last 90 days but never replied. Try a different message.",
    name: "Received but never replied",
    description: "Contacts sent a campaign in the last 90 days who haven't replied to one.",
    combinator: "and",
    conditions: [
      condition({ type: "campaign", event: "received", operator: "within", days: "90" }),
      condition({ type: "campaign", event: "replied", operator: "not_within", days: "90" }),
    ],
  },
  {
    id: "opted-out",
    label: "Opted out",
    blurb: "Everyone who unsubscribed. Useful to check before a big send.",
    name: "Opted out",
    description:
      "Contacts who are not opted in. Campaigns already skip them automatically — this is for review.",
    combinator: "and",
    conditions: [condition({ type: "field", field: "optedIn", operator: "is_false" })],
  },
]

export function getSegmentStarter(id: string | null | undefined): SegmentStarter | undefined {
  if (!id) return undefined
  return SEGMENT_STARTERS.find((starter) => starter.id === id)
}
