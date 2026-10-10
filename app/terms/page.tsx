import type { Metadata } from "next"
import Link from "next/link"
import { LEGAL_ENTITY, LegalPage, LegalSection, MailLink, legalContactEmail } from "@/components/landing/legal-page"

export const metadata: Metadata = {
  title: "Terms — Converszio",
  description: "The terms for using Converszio, the WhatsApp Business messaging platform.",
  alternates: { canonical: "/terms" },
}

export default function TermsPage() {
  const contact = legalContactEmail()
  return (
    <LegalPage title="Terms of service" updated="8 October 2026">
      <LegalSection title="Agreement">
        <p>
          These terms are an agreement between you (the business using Converszio) and {LEGAL_ENTITY}, India, which
          operates Converszio. By creating an account you accept them. If you use Converszio for a company, you confirm
          you can accept them on its behalf.
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          Converszio lets you connect your WhatsApp Business account through Meta and use it to message customers, manage
          message templates, run campaigns and automations, and see analytics. WhatsApp is provided by Meta; parts of the
          service depend on Meta&apos;s platform and can change when Meta changes it.
        </p>
      </LegalSection>

      <LegalSection title="Your responsibilities">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Follow the{" "}
            <a
              href="https://business.whatsapp.com/policy"
              className="font-medium text-lp-accent underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp Business Messaging and Commerce policies
            </a>{" "}
            and the law, including only messaging people who have agreed to hear from you and honouring opt-outs.
          </li>
          <li>Keep your login safe and tell us if you think your account has been misused.</li>
          <li>Don&apos;t use Converszio for spam, scams, illegal products or anything Meta&apos;s policies prohibit.</li>
          <li>You own your content and your customers&apos; data, and you are responsible for having the right to use it.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Fees">
        <p>
          Our platform fee is prepaid through your Converszio wallet and charged per message, at the rates shown in the
          dashboard. Meta bills its own conversation charges directly to the payment method on your WhatsApp Business
          account. Wallet balances are non-refundable except where the law requires otherwise.
        </p>
      </LegalSection>

      <LegalSection title="Suspension and ending">
        <p>
          You can stop using Converszio and delete your account at any time. We may suspend or close an account that
          breaks these terms or Meta&apos;s policies, or that puts the service or other customers at risk, and will tell
          you why where we can.
        </p>
      </LegalSection>

      <LegalSection title="Data">
        <p>
          How we handle data is described in our{" "}
          <Link href="/privacy" className="font-medium text-lp-accent underline-offset-4 hover:underline">
            privacy policy
          </Link>
          . We process your customers&apos; data on your behalf and only to provide the service.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          Converszio is provided &ldquo;as is&rdquo;. We work to keep it available and correct but cannot guarantee
          uninterrupted service, message delivery, or Meta&apos;s approval of your templates or account. To the extent the
          law allows, our total liability is limited to the fees you paid us in the three months before the claim.
        </p>
      </LegalSection>

      <LegalSection title="Changes, law and contact">
        <p>
          We may update these terms and will post changes here with a new date. These terms are governed by the laws of
          India. Questions: <MailLink email={contact} />.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
