import { FAQ, TRIAL_DAYS } from "@/lib/landing-faq"
import { FREE_SERVICE_REPLIES_PER_MONTH, GST_RATE, META_PRICING_CHECKED, formatInr } from "@/lib/meta-pricing"
import { META_RATES_INR } from "@/lib/savings"
import { SITE_URL } from "@/lib/site"
import { USE_CASE_GUIDES } from "@/lib/use-case-guides"

/**
 * /llms.txt (llmstxt.org): a plain-Markdown summary for AI answer engines.
 * Built from the same sources as the landing FAQ and the India pricing guide,
 * so a quarterly rate update reaches it with no extra edit.
 *
 * Facts only, no "best" claims (AI engines don't trust self-promotion), and
 * no Converszio plan prices: those are held back from public pages for now
 * (2026-11-19).
 */
export function buildLlmsTxt(): string {
  const gst = Math.round(GST_RATE * 100)
  const freeReplies = FREE_SERVICE_REPLIES_PER_MONTH.toLocaleString("en-IN")
  const useCases = USE_CASE_GUIDES.map((g) => `- [${g.title}](${SITE_URL}/use-cases/${g.slug}): template, Meta category and cost, setup`)
    .join("\n")
  const faq = FAQ.map(({ q, a }) => `### ${q}\n\n${a}`).join("\n\n")

  return `# Converszio

> Converszio is a WhatsApp marketing and customer conversation platform for businesses in India, built on Meta's official WhatsApp Business Platform (Cloud API). Meta bills each business's own WhatsApp Business Account directly for messages, and Converszio adds 0% markup; Converszio charges a flat monthly subscription with unlimited team seats.

Key facts (checked ${META_PRICING_CHECKED.label}):

- Product: targeted WhatsApp campaigns and segments, drip sequences, automation flows that respond to replies, a shared team inbox, WhatsApp Flows forms, WhatsApp calling, tracked links with click analytics, number health alerts, and an API with webhooks.
- Onboarding: businesses connect their own number through Meta's Embedded Signup. Coexistence is supported (the same number stays on the WhatsApp Business app). Businesses already on another provider share their existing WhatsApp Business Account.
- Pricing model: flat monthly subscription (Starter, Growth, Pro); 0% markup on Meta's message charges; no prepaid wallet; unlimited team seats; ${TRIAL_DAYS}-day free trial with no card needed for Converszio.
- Meta's India rates: ${formatInr(META_RATES_INR.marketing)} per marketing message and ${formatInr(META_RATES_INR.utility)} per utility or authentication message, before ${gst}% GST. Since 1 October 2026 only the first ${freeReplies} customer-service replies per number per month are free.
- WhatsApp is a trademark of Meta Platforms, Inc. Converszio is an independent platform built on Meta's API.

## Pages

- [Converszio home](${SITE_URL}/): product overview, savings calculator, FAQ
- [WhatsApp Business API pricing in India](${SITE_URL}/whatsapp-api-pricing-india): Meta's per-message rates, GST, what's free after 1 October 2026, worked monthly costs
${useCases}
- [Privacy policy](${SITE_URL}/privacy)
- [Terms of service](${SITE_URL}/terms)

## FAQ

${faq}
`
}
