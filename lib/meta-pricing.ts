import { META_RATES_INR } from "@/lib/savings"

/**
 * Meta's WhatsApp Business Platform pricing facts for India, shared by the
 * landing FAQ and the /whatsapp-api-pricing-india guide so a single edit keeps
 * every page (and its JSON-LD) truthful.
 *
 * Source: developers.facebook.com/docs/whatsapp/pricing and
 * .../pricing/updates-to-pricing, checked 2026-11-19. The ₹ rates themselves
 * live in META_RATES_INR (lib/savings.ts). Meta revises rates only on the
 * first day of a quarter (1 Jan / 1 Apr / 1 Jul / 1 Oct) with a month's
 * notice: re-check then and bump META_PRICING_CHECKED.
 */

/** When these facts were last checked against Meta's docs. Shown on the pages. */
export const META_PRICING_CHECKED = { label: "19 November 2026", iso: "2026-11-19", month: "November 2026" }

/** Customer-service replies Meta delivers free per business number per month, since 1 Oct 2026. */
export const FREE_SERVICE_REPLIES_PER_MONTH = 1000

/** Unique people a new business portfolio can start conversations with per rolling 24 hours. */
export const STARTING_MESSAGING_LIMIT = 250

/** GST on Meta's India list rates. */
export const GST_RATE = 0.18

export interface MessageMix {
  marketing?: number
  utility?: number
  authentication?: number
}

/**
 * What Meta charges in India for a month's delivered template messages, in
 * rupees. Service replies are left out: the first 1,000 per number are free
 * and the rest cost the utility rate, so count those as utility.
 */
export function metaCostInr(mix: MessageMix): { exGst: number; gst: number; total: number } {
  const exGst =
    (mix.marketing ?? 0) * META_RATES_INR.marketing +
    (mix.utility ?? 0) * META_RATES_INR.utility +
    (mix.authentication ?? 0) * META_RATES_INR.authentication
  const round2 = (n: number) => Math.round(n * 100) / 100
  const gst = round2(exGst * GST_RATE)
  return { exGst: round2(exGst), gst, total: round2(exGst + gst) }
}

/** ₹ with Indian digit grouping, two decimals by default, deterministic on server and client. */
export function formatInr(n: number, fractionDigits = 2): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: fractionDigits, maximumFractionDigits: Math.max(fractionDigits, 4) })}`
}
