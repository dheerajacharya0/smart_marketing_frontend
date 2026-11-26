import type { AdSummary } from "@/services/api"

/**
 * How far back the ad pickers look. The server's own cap: a rule can only name
 * an ad that started a chat within this window, which every ad still worth
 * targeting has.
 */
export const AD_PICKER_DAYS = 365

const LABEL_MAX = 60

/**
 * A human name for an ad. Meta gives the creative's headline on most ads;
 * without one the id is all there is, shortened so it reads as an id and not
 * as something the user typed.
 */
export function adLabel(ad: Pick<AdSummary, "headline" | "body" | "sourceId" | "sourceType" | "adKey">): string {
  const text = (ad.headline || ad.body || "").trim().replace(/\s+/g, " ")
  if (text) return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text
  const kind = ad.sourceType === "post" ? "Post" : "Ad"
  const id = ad.sourceId ?? ad.adKey
  return id.length > 12 ? `${kind} …${id.slice(-8)}` : `${kind} ${id}`
}

/** adKey → label resolver for rule summaries. Unknown keys resolve to undefined. */
export function adNameResolver(ads: AdSummary[] | undefined) {
  const byKey = new Map((ads ?? []).map((ad) => [ad.adKey, adLabel(ad)]))
  return (adKey: string) => byKey.get(adKey)
}
