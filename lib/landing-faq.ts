import { META_RATES_INR } from "@/lib/savings"

/**
 * Length of the free trial every new account gets. Mirrors TRIAL_PERIOD_MS in
 * backend-wb `src/auth/auth.service.ts`; change both together. Copy says only
 * that the trial is free, never what follows it: Starter may be charged later.
 *
 * Lives here, not in signup-start.tsx, because that file is "use client": a
 * server component importing a constant from it gets a client reference, not
 * the number, and the FAQ JSON-LD is built on the server.
 */
export const TRIAL_DAYS = 30

export interface FaqItem {
  q: string
  a: string
}

/**
 * The landing FAQ. Every competitor page ends on an FAQ; ours answers the
 * questions a zero-markup claim raises. Shared by the chat-style FAQ, the
 * crawlable answer list under it and the FAQPage JSON-LD, so all three agree.
 *
 * Questions and wording come from docs/research/reports/WhatsApp SaaS FAQ
 * research.md (Nov 2026): the phrasing Indian buyers search with, answer
 * first, facts near the start, since that is what AI answer engines cite.
 * Meta pricing facts are as of 1 Oct 2026 and Meta revises them on the first
 * day of each quarter (1 Jan / 1 Apr / 1 Jul / 1 Oct): re-check
 * developers.facebook.com/docs/whatsapp/pricing then, along with
 * META_RATES_INR and META_RATES_AS_OF.
 */
export const META_RATES_AS_OF = "November 2026"

const { marketing, utility } = META_RATES_INR

export const FAQ: FaqItem[] = [
  {
    q: "How much does the WhatsApp Business API cost in India?",
    a: `Meta charges per delivered message: ₹${marketing} for marketing and ₹${utility} for utility and authentication messages, plus 18% GST (rates as of ${META_RATES_AS_OF}; Meta revises them quarterly). Converszio adds 0% markup. You pay Meta directly, and Converszio charges a flat monthly subscription.`,
  },
  {
    q: "Is the WhatsApp Business API free?",
    a: "No. Connecting is free, but Meta bills every marketing, utility and authentication message it delivers. The first 1,000 customer-service replies per number each month are free, and so are messages in the free window that opens when someone messages you from a Click-to-WhatsApp ad.",
  },
  {
    q: "Are customer-service replies still free after 1 October 2026?",
    a: `Only the first 1,000 per business number per month. After that, Meta charges each reply at the utility rate (₹${utility} in India, plus GST). Utility templates are now charged even inside the 24-hour customer service window. Unused free replies don't roll over.`,
  },
  {
    q: "If there's no markup, how does Converszio make money?",
    a: "From a flat monthly subscription: Starter, Growth or Pro. Meta bills your own WhatsApp Business Account for messages, by card or UPI prepaid, so there is no Converszio wallet and nothing for us to mark up. We never take a cut of your messages.",
  },
  {
    q: "Can I keep my WhatsApp Business app and number?",
    a: "Yes. With coexistence, the same number stays on the WhatsApp Business app and also connects to the API. Up to six months of one-to-one chats and your contacts sync. Group chats don't sync, existing broadcast lists become read-only, and API sending is capped at 20 messages per second.",
  },
  {
    q: "I already use another WhatsApp API provider. Can I switch?",
    a: "Yes, without moving the number. Under Meta's current account model, numbers no longer migrate between providers. You share the WhatsApp Business Account that owns the number with Converszio. Your number, approved templates and messaging limits stay in your own Meta business portfolio.",
  },
  {
    q: "Will my number get banned for bulk WhatsApp messaging?",
    a: "Not for using the API. Bans hit tools that automate the regular WhatsApp or WhatsApp Business app, which breaks WhatsApp's terms. Converszio is built on Meta's official WhatsApp Business Platform (Cloud API), where your sending limit grows with message quality. Meta can still restrict accounts that send spam or get many blocks and reports.",
  },
  {
    q: "How many team members can I add?",
    a: "As many as you need. Every plan includes unlimited team seats (logins) with roles and email invites, so the whole team works from one shared inbox with no per-agent fee.",
  },
  {
    q: "What can I do with Converszio?",
    a: "Targeted campaigns and segments, drip sequences, automation flows that respond to replies, a shared team inbox, WhatsApp Flows forms, WhatsApp calling, tracked links with click analytics, number health alerts, and an API with webhooks. Campaigns automatically skip contacts who opted out.",
  },
  {
    q: "How do I get started?",
    a: `Sign up, connect your number through Meta's Embedded Signup, add a payment method for Meta in your WhatsApp Business Account, and send once Meta approves your template (Meta reviews within 24 hours). New accounts can message 250 unique people per 24 hours to start. Converszio's first ${TRIAL_DAYS} days are free, with no card needed.`,
  },
]

/** schema.org FAQPage for the items above. The answers must also be visible on the page. */
export function faqJsonLd(items: FaqItem[] = FAQ) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  }
}
