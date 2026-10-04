import { SEGMENT_STARTERS } from "@/lib/segment-starters"

/**
 * Goal-shaped starting points for a broadcast.
 *
 * The wizard opens on an empty name and a template picker, which assumes the
 * hard part is filling a form. It isn't — the hard part is deciding what to
 * send and who to send it to, and a first-time user has no answer to either.
 * These are the four sends a small business actually makes, named as outcomes
 * rather than features.
 *
 * Unlike a segment starter, a campaign starter cannot prefill everything: the
 * message has to be a template Meta approved for *this* account, so nothing
 * here can pick one. What a starter can do is name the campaign, point the
 * audience at the right segment, and say in one line what kind of message
 * belongs in it — which is the part a blank wizard never tells you.
 *
 * `segmentStarterId` refers to `SEGMENT_STARTERS`. The segment may not exist on
 * the account yet, so callers resolve it by name and offer to build it rather
 * than assuming it is there.
 */

export interface CampaignStarter {
  id: string
  label: string
  /** One line on the card — the outcome, not the mechanism. */
  blurb: string
  /** Prefilled campaign name. */
  name: string
  /** Which `SEGMENT_STARTERS` entry builds the audience, if one fits. */
  segmentStarterId?: string
  /** Shown next to the template picker: what to send, in plain words. */
  templateHint: string
}

export const CAMPAIGN_STARTERS: CampaignStarter[] = [
  {
    id: "win-back",
    label: "Win back quiet customers",
    blurb: "People who stopped replying. One offer or reminder to bring them back.",
    name: "Win-back",
    segmentStarterId: "gone-quiet",
    templateHint:
      "A short offer or a reason to return — a discount, a restock, something new since they last bought.",
  },
  {
    id: "reward-engaged",
    label: "Reward your best customers",
    blurb: "The people who actually read what you send. Your warmest audience.",
    name: "Thanks from us",
    segmentStarterId: "engaged-with-campaigns",
    templateHint: "Early access, a thank-you, or a perk the general list doesn't get.",
  },
  {
    id: "nudge-non-repliers",
    label: "Follow up with non-repliers",
    blurb: "Got your last campaign, never replied. Try saying it differently.",
    name: "Second try",
    segmentStarterId: "never-replied",
    templateHint:
      "A different angle to the last one — shorter, or asking a question they can answer in a word.",
  },
  {
    id: "announce",
    label: "Announce something to everyone",
    blurb: "New product, new hours, an event — to everyone on your list.",
    name: "Announcement",
    templateHint: "One clear piece of news, with what you want them to do about it.",
  },
]

export function getCampaignStarter(id: string | null | undefined): CampaignStarter | undefined {
  if (!id) return undefined
  return CAMPAIGN_STARTERS.find((s) => s.id === id)
}

/**
 * The segment name a starter's audience would be saved under.
 *
 * Segments are matched by name because that is all a saved segment carries
 * back — nothing records which starter built it. Callers should treat a miss as
 * "offer to create it", not as an error.
 */
export function starterSegmentName(starter: CampaignStarter): string | undefined {
  if (!starter.segmentStarterId) return undefined
  return SEGMENT_STARTERS.find((s) => s.id === starter.segmentStarterId)?.name
}
