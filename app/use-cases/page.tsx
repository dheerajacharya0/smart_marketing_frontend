import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage } from "@/components/landing/legal-page"
import { META_PRICING_CHECKED, formatInr } from "@/lib/meta-pricing"
import { META_RATES_INR } from "@/lib/savings"
import { USE_CASE_GUIDES } from "@/lib/use-case-guides"

const DESCRIPTION =
  "WhatsApp templates Indian businesses send every day: COD confirmation, abandoned cart, appointment reminders. Category, cost and setup for each."

export const metadata: Metadata = {
  title: "WhatsApp Business Use Cases and Templates | Converszio",
  description: DESCRIPTION,
  alternates: { canonical: "/use-cases" },
  openGraph: {
    title: "WhatsApp Business use cases",
    description: DESCRIPTION,
    url: "/use-cases",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
}

const CATEGORY_LABEL = { marketing: "Marketing", utility: "Utility", authentication: "Authentication" } as const

export default function UseCasesIndex() {
  return (
    <LegalPage title="WhatsApp Business use cases" updated={META_PRICING_CHECKED.label}>
      <p className="text-lg text-lp-fg">
        Each guide gives a template you can adapt, how Meta categorises and prices it in India, and how to run it in
        Converszio.
      </p>
      <ul className="space-y-4">
        {USE_CASE_GUIDES.map((g) => (
          <li key={g.slug} className="rounded-2xl border border-lp-line bg-lp-card p-5">
            <Link href={`/use-cases/${g.slug}`} className="font-landing text-lg font-semibold text-lp-fg hover:text-lp-accent">
              {g.title}
            </Link>
            <p className="mt-1 text-sm text-lp-subtle">
              {g.industry} · {CATEGORY_LABEL[g.category]} · {formatInr(META_RATES_INR[g.category])} per message before GST
            </p>
            <p className="mt-2">{g.summary}</p>
          </li>
        ))}
      </ul>
    </LegalPage>
  )
}
