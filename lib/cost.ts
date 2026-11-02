/**
 * Combining priced sends.
 *
 * `GET /billing/estimate` prices **one template against one audience**. Several
 * screens ask a wider question — a drip enrols a contact into a whole sequence,
 * so what someone wants to know before clicking Enrol is what the sequence
 * costs, not what its first message costs. That means several estimates, added
 * up here rather than in each screen.
 *
 * Everything below inherits the endpoint's own caveat: an estimate is an
 * **upper bound**. Meta bills per message, on the category and country in its
 * own delivery status, and only for a status it reports as billable — so some
 * priced sends land free. Adding upper bounds together gives an upper bound,
 * which is the safe direction. No markup since 2026-10-10: this is Meta's own
 * rate-card cost, billed straight to the card on the account's WhatsApp
 * Business account, not a separate platform fee.
 */

import type { CampaignCostEstimate } from "@/services/api"
import { FALLBACK_CURRENCY } from "@/lib/money"

export interface CombinedCost {
  currency: string
  /** Integer-string micros — a large audience overflows Number. Same figure
   *  as `billedByMetaMicros` — there's no markup, so nothing else to add. */
  totalMicros: string
  /** What Meta bills the card on the WhatsApp account for the same sends. */
  billedByMetaMicros: string
  /** How many contacts the send reaches. Not multiplied by message count. */
  recipientCount: number
  /** How many messages each of those contacts receives. 1 for a single send. */
  messageCount: number
  byCountry: { country: string; count: number; subtotalMicros: string }[]
  /** Every pricing category involved, in the order first seen. */
  categories: string[]
  /** True when any message was priced on an assumed category. */
  categoryAssumed: boolean
}

export function sumMicros(values: readonly (string | null | undefined)[]): string {
  let total = BigInt(0)
  for (const value of values) {
    if (!value) continue
    try {
      total += BigInt(value)
    } catch {
      // A malformed figure from the server is dropped rather than crashing the
      // panel: an incomplete price still beats a blank dialog on a send screen.
    }
  }
  return total.toString()
}

/**
 * Folds per-message estimates into one figure.
 *
 * Recipient counts are taken as the **largest** rather than summed: every
 * message in a sequence goes to the same audience, so summing would report a
 * drip with three steps as three times the people. Money is summed, because it
 * genuinely is charged three times.
 *
 * Returns null for an empty list so a caller can render nothing rather than a
 * zero, which would read as "this send is free".
 */
export function combineEstimates(estimates: readonly CampaignCostEstimate[]): CombinedCost | null {
  if (estimates.length === 0) return null

  const totalMicros = sumMicros(estimates.map((e) => e.totalMicros))
  const currency = estimates.find((e) => e.currency)?.currency ?? FALLBACK_CURRENCY

  const countries = new Map<string, { country: string; count: number; subtotals: string[] }>()
  for (const estimate of estimates) {
    for (const row of estimate.byCountry ?? []) {
      const existing = countries.get(row.country)
      if (existing) {
        existing.count = Math.max(existing.count, row.count)
        existing.subtotals.push(row.subtotalMicros)
      } else {
        countries.set(row.country, {
          country: row.country,
          count: row.count,
          subtotals: [row.subtotalMicros],
        })
      }
    }
  }

  const categories: string[] = []
  for (const estimate of estimates) {
    if (estimate.category && !categories.includes(estimate.category)) categories.push(estimate.category)
  }

  return {
    currency,
    totalMicros,
    billedByMetaMicros: sumMicros(estimates.map((e) => e.billedByMetaMicros)),
    recipientCount: Math.max(...estimates.map((e) => e.recipientCount ?? 0)),
    messageCount: estimates.length,
    byCountry: [...countries.values()].map((row) => ({
      country: row.country,
      count: row.count,
      subtotalMicros: sumMicros(row.subtotals),
    })),
    categories,
    categoryAssumed: estimates.some((e) => e.categoryAssumed),
  }
}

/**
 * Distinct (template, language) pairs, preserving order.
 *
 * A sequence that sends the same template twice is one price fetched once and
 * counted twice — the endpoint walks the whole audience on every call, so it is
 * not something to ask for redundantly.
 */
export function distinctTemplates<T extends { templateName: string; templateLanguage?: string }>(
  steps: readonly T[],
): { templateName: string; templateLanguage?: string; occurrences: number }[] {
  const byKey = new Map<string, { templateName: string; templateLanguage?: string; occurrences: number }>()
  for (const step of steps) {
    if (!step.templateName) continue
    const key = `${step.templateName}::${step.templateLanguage ?? ""}`
    const existing = byKey.get(key)
    if (existing) existing.occurrences += 1
    else
      byKey.set(key, {
        templateName: step.templateName,
        ...(step.templateLanguage ? { templateLanguage: step.templateLanguage } : {}),
        occurrences: 1,
      })
  }
  return [...byKey.values()]
}

/**
 * A priced estimate repeated for each time its template appears in a sequence.
 * `combineEstimates` sums what it is given, so a template used twice has to be
 * handed over twice.
 */
export function expandByOccurrences(
  priced: readonly { estimate: CampaignCostEstimate; occurrences: number }[],
): CampaignCostEstimate[] {
  const out: CampaignCostEstimate[] = []
  for (const { estimate, occurrences } of priced) {
    for (let i = 0; i < occurrences; i++) out.push(estimate)
  }
  return out
}
