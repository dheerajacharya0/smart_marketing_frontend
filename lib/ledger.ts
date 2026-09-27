/**
 * Display rules for the revenue ledger (`/dashboard/revenue`).
 *
 * Every figure is computed server-side from the wallet and the conversions
 * table; nothing here does money arithmetic beyond comparing two totals the
 * server already produced. Amounts are displayed from `units`, as everywhere
 * else (see lib/money.ts).
 */
import type { CreditedSource } from "@/services/api"

/** What each message source is called on the page. */
const SOURCE_LABELS: Record<string, string> = {
  campaign: "Campaigns",
  drip: "Drips",
  flow: "Flows",
  automation: "Automations",
  manual: "Inbox replies",
  api: "Your API",
  system: "System messages",
  unattributed: "Not attributed",
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source
}

/** Singular, for a sender row: "Campaign", "Drip"… */
const SENDER_KIND: Record<CreditedSource, string> = {
  campaign: "Campaign",
  drip: "Drip",
  flow: "Flow",
  automation: "Automation",
}

export function senderKind(type: CreditedSource): string {
  return SENDER_KIND[type] ?? type
}

/** Where a sender lives in the dashboard. Automation rules have no page of their own. */
export function senderHref(type: CreditedSource, id: string): string {
  switch (type) {
    case "campaign":
      return `/dashboard/campaigns/${id}`
    case "drip":
      return `/dashboard/drips/${id}`
    case "flow":
      return `/dashboard/flows/${id}`
    case "automation":
      return "/dashboard/automation"
  }
}

/**
 * Return on spend as a multiple: "12.8×". Two decimals under 10× so 1.05× and
 * 1.5× stay distinguishable; one above, where the second decimal is noise.
 * "—" when nothing was spent, which is not the same as earning nothing (0×).
 */
export function formatReturn(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  const digits = value >= 10 ? 1 : 2
  return `${value.toFixed(digits).replace(/\.?0+$/, "")}×`
}

/**
 * Percentage change from `previous` to `current`, or null when there is no
 * previous figure to compare against — a jump from 0 has no honest percentage.
 */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** "+12% vs previous", "−8% vs previous", "new this period", or "same as previous". */
export function describeChange(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "same as previous" : "new this period"
  const pct = percentChange(current, previous)
  if (pct === null) return ""
  const rounded = Math.round(pct)
  if (rounded === 0) return "same as previous"
  // U+2212 minus, so the sign lines up with "+" in tabular figures.
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)}% vs previous`
}

/**
 * Why an account with a store connected (or API reporting) can still see no
 * attributed revenue — the empty states have to say which case it is, or the
 * page reads as broken.
 */
export function explainNoAttribution(opts: {
  orders: number
  attributedOrders: number
  messages: number
  windowDays: number
}): string | null {
  if (opts.attributedOrders > 0) return null
  if (opts.orders === 0) {
    return "No sales reported in this range yet. They arrive from your store, your API key, or “Record a sale”."
  }
  if (opts.messages === 0) {
    return "Sales arrived, but no messages were sent in this range, so none can take credit."
  }
  return `Sales arrived, but none came within ${opts.windowDays} day${
    opts.windowDays === 1 ? "" : "s"
  } of a message to the same number.`
}
