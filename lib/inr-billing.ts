/**
 * Meta's India billing localisation. Since 1 Jan 2026, businesses whose
 * Sold-To country in Meta Billing Hub is India are billed in INR, and every
 * Messaging account in their portfolio must be on INR by 31 Dec 2026: from
 * 1 Jan 2027 Meta stops delivering messages from their non-INR accounts.
 * Source: developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing
 * (checked 2026-11-19). Meta doesn't say how this applies to businesses
 * onboarded through a Tech Provider, so the notice is conditional on the
 * Sold-To country rather than asserting the account is affected.
 */

import type { WabaMetaSpend } from "@/services/api"

/** Last day a non-INR account of an eligible business still delivers. */
export const INR_BILLING_DEADLINE = new Date("2026-12-31T23:59:59+05:30")

export const INR_BILLING_SOURCE = "https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing"

/**
 * WABAs Meta bills the business for directly in a currency other than INR.
 * Partner-billed accounts (`cost_unavailable`) are on our credit line, so the
 * business has nothing to migrate; an unknown currency (null) or an error
 * isn't evidence of anything, so neither gets the notice.
 */
export function wabasNotOnInr(wabas: WabaMetaSpend[]): WabaMetaSpend[] {
  return wabas.filter((w) => w.status === "ok" && !!w.currency && w.currency.toUpperCase() !== "INR")
}

export function isPastInrDeadline(now: Date = new Date()): boolean {
  return now.getTime() > INR_BILLING_DEADLINE.getTime()
}
