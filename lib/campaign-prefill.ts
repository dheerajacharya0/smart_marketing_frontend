import type { Campaign, FollowUpFilter, SegmentRules, TemplateHeaderMedia } from "@/services/api"

/** Who a prefilled campaign goes to. Mirrors the wizard's audience choices. */
export type PrefillAudience =
  | { mode: "all" }
  | { mode: "tag"; tag: string }
  /** Several tags, or a tag narrowed by others — see lib/audience-tags. */
  | { mode: "tagRules"; rules: SegmentRules }
  | { mode: "segment"; segmentId: string }
  | { mode: "followUp"; campaignId: string; campaignName: string; filter: FollowUpFilter }

/**
 * A campaign the wizard opens with, already filled in. Everything stays
 * editable: this saves typing, it doesn't decide anything.
 */
export interface CampaignPrefill {
  /** Why the wizard was opened; changes its title. */
  kind: "duplicate" | "followUp"
  name: string
  /** Empty for a follow-up: a nudge usually says something different. */
  templateName: string
  templateLanguage?: string
  templateParameters: string[]
  headerMedia?: TemplateHeaderMedia
  trackLinks: boolean
  audience: PrefillAudience
  /** Omitted to let the wizard suggest one from the name, as it does for a new campaign. */
  labels?: string[]
}

export const FOLLOW_UP_FILTER_LABELS: Record<FollowUpFilter, string> = {
  not_replied: "Didn't reply",
  not_read: "Didn't read",
  reached: "Everyone it reached",
  replied: "Replied",
}

/** Menu order: the follow-up people actually send first. */
export const FOLLOW_UP_FILTER_ORDER: FollowUpFilter[] = ["not_replied", "not_read", "reached", "replied"]

/**
 * How many people each follow-up would reach, from the campaign's own counters.
 * An estimate for the menu only: the wizard shows the real count, which can
 * be lower because someone may have opted out since.
 */
export function followUpCounts(c: Pick<Campaign, "sentCount" | "readCount" | "repliedCount">) {
  const reached = c.sentCount
  const replied = Math.min(c.repliedCount ?? 0, reached)
  return {
    reached,
    replied,
    not_replied: Math.max(0, reached - replied),
    not_read: Math.max(0, reached - Math.min(c.readCount, reached)),
  } satisfies Record<FollowUpFilter, number>
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const DATED = new RegExp(`-(\\d{1,2})-(${MONTHS.join("|")})$`)

/**
 * A label dated by the campaign it came from ("diwali-sale-30-sep"), moved to
 * today. Running the same campaign again tomorrow should label tomorrow's
 * people with tomorrow's date, not add them to yesterday's list. Labels without
 * a date are the business's own and are kept as they are.
 */
export function relabelForToday(label: string, now: Date = new Date()): string {
  if (!DATED.test(label)) return label
  return label.replace(DATED, `-${now.getDate()}-${MONTHS[now.getMonth()]}`)
}

function audienceOf(c: Campaign, followedName = ""): PrefillAudience {
  if (c.followUpCampaignId && c.followUpFilter) {
    // A duplicated follow-up keeps following the same original campaign.
    return { mode: "followUp", campaignId: c.followUpCampaignId, campaignName: followedName, filter: c.followUpFilter }
  }
  if (c.segmentId) return { mode: "segment", segmentId: c.segmentId }
  if (c.audienceRules) return { mode: "tagRules", rules: c.audienceRules }
  if (c.audienceTag) return { mode: "tag", tag: c.audienceTag }
  return { mode: "all" }
}

/**
 * The same campaign again: same message and audience, labels moved to today.
 * `followedName` names the original campaign when `c` is itself a follow-up.
 */
export function duplicatePrefill(c: Campaign, now: Date = new Date(), followedName?: string): CampaignPrefill {
  return {
    kind: "duplicate",
    name: c.name,
    templateName: c.templateName,
    templateLanguage: c.templateLanguage,
    templateParameters: c.templateParameters ?? [],
    headerMedia: c.headerMedia ?? undefined,
    trackLinks: !!c.trackLinks,
    audience: audienceOf(c, followedName),
    labels: [...new Set((c.recipientTags ?? []).map((l) => relabelForToday(l, now)))],
  }
}

/** A new message to the people an earlier campaign reached, narrowed by `filter`. */
export function followUpPrefill(c: Campaign, filter: FollowUpFilter): CampaignPrefill {
  return {
    kind: "followUp",
    name: `${c.name} — follow-up`,
    templateName: "",
    templateParameters: [],
    trackLinks: !!c.trackLinks,
    audience: { mode: "followUp", campaignId: c.id, campaignName: c.name, filter },
  }
}
