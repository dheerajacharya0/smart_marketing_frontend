import type React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, LegalSection } from "@/components/landing/legal-page"
import { TRIAL_DAYS, faqJsonLd, type FaqItem } from "@/lib/landing-faq"
import {
  FREE_SERVICE_REPLIES_PER_MONTH,
  GST_RATE,
  META_PRICING_CHECKED,
  formatInr,
  metaCostInr,
  type MessageMix,
} from "@/lib/meta-pricing"
import { META_RATES_INR } from "@/lib/savings"
import { SITE_URL } from "@/lib/site"

/**
 * Public guide to what Meta charges for the WhatsApp Business API in India.
 * Built from docs/research/reports/WhatsApp SaaS FAQ research.md: buyers'
 * most-asked questions are about cost, competitor answers are stale after
 * Meta's 1 Oct 2026 change, and AI answer engines cite dated, specific,
 * answer-first pages. Every figure comes from lib/meta-pricing.ts and
 * META_RATES_INR, so a quarterly re-check is a one-file edit.
 *
 * Deliberately silent on Converszio's own plan prices (held back, 2026-11-19)
 * and on things the research could not verify: Meta's invoicing entity,
 * reverse charge, the exact free-window length after Click-to-WhatsApp ads.
 */

const PATH = "/whatsapp-api-pricing-india"
const { marketing, utility, authentication } = META_RATES_INR
const GST_PCT = Math.round(GST_RATE * 100)
const FREE_REPLIES = FREE_SERVICE_REPLIES_PER_MONTH.toLocaleString("en-IN")
const withGst = (rate: number) => formatInr(Math.round(rate * (1 + GST_RATE) * 10000) / 10000)

const TITLE = `WhatsApp Business API Pricing in India (${META_PRICING_CHECKED.month})`

const OG_DESCRIPTION = `Per-message rates, what's still free, GST and worked monthly costs. Checked ${META_PRICING_CHECKED.label}.`
const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "Converszio: WhatsApp marketing with zero markup on Meta" }

export const metadata: Metadata = {
  title: `WhatsApp API Pricing India ${META_PRICING_CHECKED.iso.slice(0, 4)}: Rates & GST | Converszio`,
  description: `Meta's India rates: ${formatInr(marketing)} per marketing and ${formatInr(utility)} per utility message, plus ${GST_PCT}% GST. What's free after 1 Oct 2026, with worked examples.`,
  alternates: { canonical: PATH },
  // A child route's `openGraph` replaces the root's, and the file-based image
  // in app/opengraph-image.tsx only attaches to its own segment, so the share
  // card has to be named here or the link previews with no image.
  openGraph: {
    title: TITLE,
    description: OG_DESCRIPTION,
    type: "article",
    url: PATH,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: OG_DESCRIPTION,
    images: [SHARE_IMAGE.url],
  },
}

const RATES = [
  { category: "Marketing", rate: marketing, when: "Offers, announcements, reminders to come back. Charged every time." },
  { category: "Utility", rate: utility, when: "Order, payment and appointment updates. Charged every time, including inside the 24-hour window." },
  { category: "Authentication", rate: authentication, when: "One-time passwords and login codes." },
  {
    category: "Service replies",
    rate: utility,
    when: `Free-form replies to a customer who messaged you. First ${FREE_REPLIES} per number per month free, then the utility rate.`,
  },
]

const EXAMPLES: { label: string; mix: MessageMix }[] = [
  { label: "1,000 marketing", mix: { marketing: 1000 } },
  { label: "5,000 utility", mix: { utility: 5000 } },
  { label: "2,000 marketing + 5,000 utility", mix: { marketing: 2000, utility: 5000 } },
  { label: "10,000 marketing + 10,000 utility + 2,000 OTPs", mix: { marketing: 10000, utility: 10000, authentication: 2000 } },
]

const worked = metaCostInr({ marketing: 2000, utility: 5000 })

const FAQ: FaqItem[] = [
  {
    q: "How much does a WhatsApp Business API message cost in India?",
    a: `Meta charges ${formatInr(marketing)} per marketing message and ${formatInr(utility)} per utility or authentication message delivered to Indian numbers, before ${GST_PCT}% GST (rates checked ${META_PRICING_CHECKED.label}). Meta bills per delivered message, not per conversation, and revises rates only at the start of a quarter.`,
  },
  {
    q: "Are customer-service replies still free after 1 October 2026?",
    a: `Only the first ${FREE_REPLIES} per business number per month. After that, Meta charges each reply at the utility rate (${formatInr(utility)} in India, plus GST). Utility templates are now charged even inside the 24-hour customer service window. Unused free replies don't roll over.`,
  },
  {
    q: "What does it cost to send 2,000 marketing and 5,000 utility messages a month?",
    a: `About ${formatInr(worked.exGst)} to Meta before GST (2,000 × ${formatInr(marketing)} + 5,000 × ${formatInr(utility)}), or about ${formatInr(worked.total)} with ${GST_PCT}% GST. Your WhatsApp platform's own fee comes on top.`,
  },
  {
    q: "Which number decides the rate: mine or my customer's?",
    a: "Your customer's. Meta prices each message by the recipient's country and the message category. An Indian business messaging Indian users pays India's domestic rates.",
  },
  {
    q: "Is GST charged on WhatsApp API messages?",
    a: `Yes. Meta's India rates are listed before ${GST_PCT}% GST. If you pay Meta by UPI prepaid, Meta says the charges include applicable Indian GST. Ask your accountant about input tax credit.`,
  },
  {
    q: "Do I need to move my WhatsApp billing to INR?",
    a: "If your WhatsApp Business Account is billed in another currency and its Sold-To country in Meta Billing Hub is India, yes. Meta requires INR billing by 31 December 2026 and stops delivering messages from non-INR accounts on 1 January 2027.",
  },
  {
    q: "Do rates get cheaper at higher volume?",
    a: "Not for marketing. Meta's volume discounts cover only utility and authentication messages, and they start at millions of messages a month, so almost no small business reaches them.",
  },
  {
    q: "Is anything about the WhatsApp Business API free?",
    a: `Connecting is free, undelivered messages aren't billed, the first ${FREE_REPLIES} service replies per number each month are free, and messages in the free window that opens when someone messages you from a Click-to-WhatsApp ad are free. Everything else is charged per delivered message.`,
  },
]

const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    dateModified: META_PRICING_CHECKED.iso,
    mainEntityOfPage: `${SITE_URL}${PATH}`,
    author: { "@type": "Organization", name: "Converszio", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Converszio", url: SITE_URL, logo: `${SITE_URL}/converszio-logo.png` },
  },
  faqJsonLd(FAQ),
]

const cell = "border-b border-lp-line px-3 py-2.5 text-left align-top"
const ext = "font-medium text-lp-accent underline-offset-4 hover:underline"

function MetaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={ext}>
      {children}
    </a>
  )
}

export default function IndiaApiPricingPage() {
  return (
    <LegalPage title={TITLE} updated={META_PRICING_CHECKED.label}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* Answer first: this paragraph is what search and AI engines lift. */}
      <p className="text-lg text-lp-fg">
        Meta charges Indian businesses <strong>{formatInr(marketing)} per marketing message</strong> and{" "}
        <strong>{formatInr(utility)} per utility or authentication message</strong> on the WhatsApp Business API, plus{" "}
        {GST_PCT}% GST. It bills each delivered message, not each conversation. Since 1 October 2026, only the first{" "}
        {FREE_REPLIES} customer-service replies per number each month are free.
      </p>

      <LegalSection title="Meta's per-message rates for India">
        <div className="overflow-x-auto rounded-xl border border-lp-line">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-lp-card text-lp-fg">
              <tr>
                <th className={cell}>Message type</th>
                <th className={cell}>Before GST</th>
                <th className={cell}>With {GST_PCT}% GST</th>
                <th className={cell}>When it applies</th>
              </tr>
            </thead>
            <tbody>
              {RATES.map((r) => (
                <tr key={r.category}>
                  <th scope="row" className={`${cell} font-semibold text-lp-fg`}>{r.category}</th>
                  <td className={`${cell} tabular-nums`}>{formatInr(r.rate)}</td>
                  <td className={`${cell} tabular-nums`}>{withGst(r.rate)}</td>
                  <td className={cell}>{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-lp-subtle">
          Rates for messages delivered to Indian numbers, checked against Meta&apos;s{" "}
          <MetaLink href="https://developers.facebook.com/docs/whatsapp/pricing">pricing page</MetaLink> on{" "}
          {META_PRICING_CHECKED.label}. Meta changes rates only on 1 January, 1 April, 1 July and 1 October, with a
          month&apos;s notice.
        </p>
      </LegalSection>

      <LegalSection title="What changed on 1 October 2026">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Customer-service replies are free only for the first {FREE_REPLIES} per business number per month. After
            that, each reply costs the utility rate. Unused free replies don&apos;t roll over.
          </li>
          <li>Utility templates are charged even when you send them inside the 24-hour customer service window.</li>
          <li>India&apos;s rates themselves did not change on 1 October 2026.</li>
        </ul>
        <p>
          Since 1 July 2025 Meta has billed per delivered template message, priced by category and the recipient&apos;s
          country. Pages that still talk about &quot;per conversation&quot; pricing or free service conversations are
          out of date.
        </p>
      </LegalSection>

      <LegalSection title="What a month costs: worked examples">
        <div className="overflow-x-auto rounded-xl border border-lp-line">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-lp-card text-lp-fg">
              <tr>
                <th className={cell}>Messages delivered in a month</th>
                <th className={cell}>Meta, before GST</th>
                <th className={cell}>Meta, with GST</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLES.map((e) => {
                const c = metaCostInr(e.mix)
                return (
                  <tr key={e.label}>
                    <th scope="row" className={`${cell} font-medium text-lp-fg`}>{e.label}</th>
                    <td className={`${cell} tabular-nums`}>{formatInr(c.exGst)}</td>
                    <td className={`${cell} tabular-nums`}>{formatInr(c.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-lp-subtle">
          Meta&apos;s charges only. Service replies beyond the free {FREE_REPLIES} cost the same as utility messages. Your
          WhatsApp platform&apos;s own fee, and any markup it adds to Meta&apos;s rate, come on top.
        </p>
      </LegalSection>

      <LegalSection title="What's free">
        <ul className="list-disc space-y-1 pl-5">
          <li>Connecting a number to the WhatsApp Business API.</li>
          <li>The first {FREE_REPLIES} customer-service replies per business number each month.</li>
          <li>Messages in the free window that opens when a customer messages you from a Click-to-WhatsApp ad.</li>
          <li>Messages that aren&apos;t delivered: Meta charges per delivered message.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How you pay Meta, and GST">
        <p>
          Meta bills your own WhatsApp Business Account through Meta Billing Hub: invoiced to a saved card, or prepaid by
          UPI. India&apos;s list rates are before {GST_PCT}% GST. For UPI prepaid, Meta says the charges include
          applicable Indian GST.
        </p>
        <p>
          <strong>INR deadline:</strong> businesses whose Sold-To country in Billing Hub is India must have every
          WhatsApp messaging account billed in INR by 31 December 2026. From 1 January 2027, Meta stops delivering
          messages from their non-INR accounts (
          <MetaLink href="https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing">Meta&apos;s notice</MetaLink>).
        </p>
      </LegalSection>

      <LegalSection title="Platform fees and markup">
        <p>
          A WhatsApp platform&apos;s bill is two things: Meta&apos;s message charges and the platform&apos;s own fee.
          Some platforms pass Meta&apos;s rate through; others add a markup per message or collect it through a prepaid
          wallet. Compare the per-message price a platform shows with Meta&apos;s rate above.
        </p>
        <p>
          Converszio adds 0% markup: Meta bills your WhatsApp Business Account directly, there is no wallet, and
          Converszio charges a flat monthly subscription with unlimited team seats.{" "}
          <Link href="/#pricing" className={ext}>
            See how much you&apos;d save
          </Link>{" "}
          or{" "}
          <Link href="/login?mode=signup" className={ext}>
            start a free {TRIAL_DAYS}-day trial
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Questions">
        <div className="space-y-5">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold text-lp-fg">{q}</h3>
              <p className="mt-1">{a}</p>
            </div>
          ))}
        </div>
      </LegalSection>
    </LegalPage>
  )
}
