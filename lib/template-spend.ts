import type { TemplateSpend, WabaTemplateSpend } from "@/services/api"

/**
 * Which cost figure a Template costs row shows.
 *
 * - `meta`: Meta's own `amount_spent` — approximate, ex-tax, the real bill.
 * - `estimate`: our rate-card estimate for the sends Meta's status webhook
 *   marked billable — tax-inclusive, shown only when Meta's figure is missing
 *   (analytics off, Meta error, or Meta reporting 0 for sends it did charge).
 * - `free`: Meta's figures are in and nothing was charged.
 * - `none`: no cost information at all (partner credit line, nothing billable).
 */
export type RowCost =
  | { kind: "meta"; amount: number; currency: string | undefined }
  | { kind: "estimate"; amount: number; currency: string | undefined }
  | { kind: "free"; currency: string | undefined }
  | { kind: "none" }

export function rowCost(t: TemplateSpend, spend: WabaTemplateSpend): RowCost {
  const metaCurrency = spend.currency ?? undefined
  const metaIn = spend.status === "ok"
  if (metaIn && t.amountSpent > 0) return { kind: "meta", amount: t.amountSpent, currency: metaCurrency }
  if (t.estimatedCost != null && t.estimatedCost > 0) {
    return { kind: "estimate", amount: t.estimatedCost, currency: spend.estimateCurrency }
  }
  if (metaIn) return { kind: "free", currency: metaCurrency }
  return { kind: "none" }
}

const categoryLabel = (c: string | null) =>
  c ? c.charAt(0) + c.slice(1).toLowerCase() : "Uncategorized"

/**
 * The muted second line of a row, e.g.
 * "Utility · 4 sent · 4 delivered · 1 failed · ₹0.12/delivered · 3 clicks".
 * Zero-valued extras (failed, clicks) are left out; sent and delivered never
 * are — "0 delivered" is a real, useful number when it comes from our own
 * records.
 */
export function rowDetail(
  t: TemplateSpend,
  cost: RowCost,
  money: (n: number) => string,
): string {
  const parts = [
    categoryLabel(t.category),
    `${t.sent.toLocaleString()} sent`,
    `${t.delivered.toLocaleString()} delivered`,
  ]
  if (t.failed) parts.push(`${t.failed.toLocaleString()} failed`)
  if (cost.kind === "meta" && t.costPerDelivered != null) {
    parts.push(`${money(t.costPerDelivered)}/delivered`)
  }
  const clicks = t.urlClicks + t.quickReplyClicks
  if (clicks > 0) parts.push(`${clicks.toLocaleString()} click${clicks === 1 ? "" : "s"}`)
  return parts.join(" · ")
}

/**
 * Row titles. A template name approved in two languages is two rows, so those
 * get the language appended; a unique name shows bare.
 */
export function rowTitles(templates: TemplateSpend[]): Map<string, string> {
  const name = (t: TemplateSpend) => t.name ?? `Template ${t.templateId.slice(-6)}`
  const seen = new Map<string, number>()
  for (const t of templates) seen.set(name(t), (seen.get(name(t)) ?? 0) + 1)
  return new Map(
    templates.map((t) => [
      t.templateId,
      (seen.get(name(t)) ?? 0) > 1 && t.language ? `${name(t)} (${t.language})` : name(t),
    ]),
  )
}
