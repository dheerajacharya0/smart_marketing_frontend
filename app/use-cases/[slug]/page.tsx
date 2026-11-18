import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { LegalPage, LegalSection } from "@/components/landing/legal-page"
import { TRIAL_DAYS, faqJsonLd } from "@/lib/landing-faq"
import { GST_RATE, META_PRICING_CHECKED, formatInr, metaCostInr } from "@/lib/meta-pricing"
import { META_RATES_INR } from "@/lib/savings"
import { SITE_URL } from "@/lib/site"
import { USE_CASE_GUIDES, findUseCaseGuide } from "@/lib/use-case-guides"

/**
 * One prerendered page per guide. Unknown slugs fall through to the render
 * below and 404 via notFound(). Not `dynamicParams = false`: with it, every
 * unknown slug logs an internal NoFallbackError and a literal
 * /use-cases/%5Bslug%5D returns 500, both of which would reach Sentry through
 * onRequestError in instrumentation.ts.
 */
export function generateStaticParams() {
  return USE_CASE_GUIDES.map((g) => ({ slug: g.slug }))
}

const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "Converszio: WhatsApp marketing with zero markup on Meta" }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = findUseCaseGuide((await params).slug)
  if (!guide) return {}
  const path = `/use-cases/${guide.slug}`
  // A child route's openGraph replaces the root's, so the share image is named here.
  return {
    title: guide.metaTitle,
    description: guide.description,
    alternates: { canonical: path },
    openGraph: { title: guide.title, description: guide.description, type: "article", url: path, images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title: guide.title, description: guide.description, images: [SHARE_IMAGE.url] },
  }
}

const CATEGORY_LABEL = { marketing: "Marketing", utility: "Utility", authentication: "Authentication" } as const
const ext = "font-medium text-lp-accent underline-offset-4 hover:underline"

export default async function UseCaseGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = findUseCaseGuide((await params).slug)
  if (!guide) notFound()

  const rate = META_RATES_INR[guide.category]
  const per1000 = metaCostInr({ [guide.category]: 1000 })
  const gstPct = Math.round(GST_RATE * 100)
  const others = USE_CASE_GUIDES.filter((g) => g.slug !== guide.slug)

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      dateModified: META_PRICING_CHECKED.iso,
      mainEntityOfPage: `${SITE_URL}/use-cases/${guide.slug}`,
      author: { "@type": "Organization", name: "Converszio", url: SITE_URL },
      publisher: { "@type": "Organization", name: "Converszio", url: SITE_URL, logo: `${SITE_URL}/converszio-logo.png` },
    },
    faqJsonLd(guide.faq),
  ]

  return (
    <LegalPage title={guide.title} updated={META_PRICING_CHECKED.label}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <p className="text-lg text-lp-fg">{guide.summary}</p>

      <LegalSection title="Template you can use">
        {/* A WhatsApp-style bubble so the template reads as the message the customer gets. */}
        <figure className="rounded-2xl border border-lp-line bg-lp-card p-4">
          <figcaption className="mb-3 flex flex-wrap items-center gap-2 text-xs text-lp-subtle">
            <code className="rounded bg-lp-elev px-1.5 py-0.5">{guide.template.name}</code>
            <span>
              Meta category: <strong className="text-lp-fg">{CATEGORY_LABEL[guide.category]}</strong>
            </span>
          </figcaption>
          <div className="max-w-md rounded-2xl rounded-tl-sm bg-lp-elev px-4 py-3 text-[0.95rem] text-lp-fg shadow-sm">
            <p className="whitespace-pre-line">{guide.template.body}</p>
            <div className="mt-3 flex flex-col gap-1.5 border-t border-lp-line pt-2">
              {guide.template.buttons.map((b) => (
                <span key={b} className="text-center text-sm font-medium text-lp-accent">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </figure>
        <p className="text-sm text-lp-subtle">
          {"{{1}}"}, {"{{2}}"}… are variables your system fills in for each customer. Adjust the wording to your brand;
          Meta reviews every template before it can be sent.
        </p>
      </LegalSection>

      <LegalSection title={`Why it's a ${CATEGORY_LABEL[guide.category]} message, and what it costs`}>
        <p>{guide.template.whyCategory}</p>
        <p>
          In India, Meta charges <strong>{formatInr(rate)}</strong> per delivered {CATEGORY_LABEL[guide.category].toLowerCase()}{" "}
          message before {gstPct}% GST. <strong>1,000 messages cost {formatInr(per1000.exGst)}</strong>, or{" "}
          {formatInr(per1000.total)} with GST. Undelivered messages aren&apos;t charged. Rates checked{" "}
          {META_PRICING_CHECKED.label};{" "}
          <Link href="/whatsapp-api-pricing-india" className={ext}>
            full India pricing guide
          </Link>
          .
        </p>
        <p className="rounded-xl border border-lp-line bg-lp-card p-4">
          <strong className="text-lp-fg">Watch out: </strong>
          {guide.watchOut}
        </p>
      </LegalSection>

      <LegalSection title="How to set it up in Converszio">
        <ol className="list-decimal space-y-3 pl-5">
          {guide.steps.map((s) => (
            <li key={s.title}>
              <strong className="text-lp-fg">{s.title}.</strong> {s.body}
            </li>
          ))}
        </ol>
        <p>
          Converszio adds 0% markup to Meta&apos;s charges: Meta bills your own WhatsApp Business Account directly.{" "}
          <Link href="/login?mode=signup" className={ext}>
            Start a free {TRIAL_DAYS}-day trial
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Questions">
        <div className="space-y-5">
          {guide.faq.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold text-lp-fg">{q}</h3>
              <p className="mt-1">{a}</p>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection title="More WhatsApp use cases">
        <ul className="list-disc space-y-1 pl-5">
          {others.map((g) => (
            <li key={g.slug}>
              <Link href={`/use-cases/${g.slug}`} className={ext}>
                {g.title}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/use-cases" className={ext}>
              All use cases
            </Link>
          </li>
        </ul>
      </LegalSection>
    </LegalPage>
  )
}
