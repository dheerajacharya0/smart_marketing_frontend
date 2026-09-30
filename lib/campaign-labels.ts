/** Labels one campaign may add to the contacts it reaches. Matches the backend limit. */
export const MAX_CAMPAIGN_LABELS = 5

// A day inside a slug, e.g. "-30-sep" in "diwali-30-sep-follow-up".
const DAY_IN_SLUG = /-\d{1,2}-(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?=-|$)/g

/** Contact tags are stored trimmed and lowercased; a label is a tag. */
export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase()
}

/**
 * The label offered by default: the campaign name plus the day it is created,
 * e.g. "diwali sale" on 30 Sep 2026 becomes "diwali-sale-30-sep". A business
 * that runs the same campaign daily gets one label per day, so it can tell who
 * was messaged when and whom to follow up.
 */
export function suggestCampaignLabel(name: string, now: Date = new Date()): string {
  const slug = normalizeLabel(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    // A name that already carries a day ("hello_world · 1 Oct", the default
    // name, or a follow-up "hello_world · 1 Oct — follow-up") would otherwise
    // get two dates. The label gets exactly one: today's, at the end.
    .replace(DAY_IN_SLUG, "")
    .slice(0, 40)
    .replace(/-+$/g, "")
  const month = now.toLocaleString("en", { month: "short" }).toLowerCase()
  const day = `${now.getDate()}-${month}`
  return slug ? `${slug}-${day}` : `campaign-${day}`
}

/** Adds a label if it is new and there is room; returns the list unchanged otherwise. */
export function addLabel(labels: string[], raw: string): string[] {
  const label = normalizeLabel(raw)
  if (!label || labels.includes(label) || labels.length >= MAX_CAMPAIGN_LABELS) return labels
  return [...labels, label]
}
