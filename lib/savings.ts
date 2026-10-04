/**
 * Landing-page calculator. Pure maths so the page and the tests agree.
 *
 * Meta rates: India, per delivered message, excluding GST — the figures in
 * docs/revenue-and-business-plan.md ("Market facts"). Competitor plans: the
 * entry paid tier from each tool's published pricing and the markup estimates
 * in the competitor table of the same doc. Markups are estimates, several
 * marked unverified there — re-check before publishing.
 */

export const META_RATES_INR = {
  marketing: 0.8631,
  utility: 0.115,
  authentication: 0.115,
} as const

export type MessageCategory = keyof typeof META_RATES_INR

export interface Provider {
  id: string
  name: string
  /** Monthly plan price, INR. */
  plan: number
  /** Markup on Meta's per-message rate, as a fraction (0.2 = 20%). */
  markup: number
  /** Plan name shown under the provider. */
  planLabel: string
}

export const CONVERSZIO: Provider = {
  id: "converszio",
  name: "Converszio",
  plan: 0,
  markup: 0,
  planLabel: "Free plan · pay Meta directly",
}

export const COMPETITORS: Provider[] = [
  { id: "wati", name: "WATI", plan: 2199, markup: 0.2, planLabel: "Growth plan" },
  { id: "aisensy", name: "AiSensy", plan: 1500, markup: 0.26, planLabel: "Basic plan" },
  { id: "interakt", name: "Interakt", plan: 2800, markup: 0.2, planLabel: "Growth plan" },
  { id: "gallabox", name: "Gallabox", plan: 2400, markup: 0.15, planLabel: "Growth plan" },
]

export interface Quote {
  provider: Provider
  /** What Meta charges for the messages themselves. */
  metaCost: number
  /** Extra added on top of Meta's rate. */
  markupCost: number
  /** plan + metaCost + markupCost. */
  total: number
}

const clean = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

export function quote(provider: Provider, messages: number, category: MessageCategory): Quote {
  const metaCost = clean(messages) * META_RATES_INR[category]
  const markupCost = metaCost * provider.markup
  return { provider, metaCost, markupCost, total: provider.plan + metaCost + markupCost }
}

export interface Comparison {
  ours: Quote
  /** Competitors, cheapest first. */
  theirs: Quote[]
  /** Savings against the priciest competitor, per month. */
  maxSavings: number
  /** Savings against the competitor average, per month. */
  avgSavings: number
}

export function compare(messages: number, category: MessageCategory): Comparison {
  const ours = quote(CONVERSZIO, messages, category)
  const theirs = COMPETITORS.map((p) => quote(p, messages, category)).sort((a, b) => a.total - b.total)
  const max = Math.max(...theirs.map((q) => q.total))
  const avg = theirs.reduce((s, q) => s + q.total, 0) / theirs.length
  return {
    ours,
    theirs,
    maxSavings: Math.max(0, max - ours.total),
    avgSavings: Math.max(0, avg - ours.total),
  }
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

export function formatInr(amount: number): string {
  return inr.format(Math.round(amount))
}
