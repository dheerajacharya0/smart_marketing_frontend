import type { Metadata } from "next"
import { LegalPage, LegalSection, MailLink, legalContactEmail } from "@/components/landing/legal-page"

export const metadata: Metadata = {
  title: "Data deletion — Converszio",
  description: "How to remove Converszio's access to your Facebook and WhatsApp data and have it deleted.",
}

/** The "User data deletion" instructions URL registered on the Meta app. */
export default function DataDeletionPage() {
  const contact = legalContactEmail()
  return (
    <LegalPage title="Data deletion" updated="8 October 2026">
      <LegalSection title="Remove Converszio's access in Facebook">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open Facebook and go to Settings &amp; privacy → Settings.</li>
          <li>Open Business Integrations (or Apps and websites).</li>
          <li>Find Converszio and select Remove.</li>
        </ol>
        <p>This stops Converszio from accessing your Facebook and WhatsApp Business data from that moment.</p>
      </LegalSection>

      <LegalSection title="Disconnect WhatsApp in Converszio">
        <p>
          In the Converszio dashboard, open WhatsApp, choose the number and remove it. This stops messaging through that
          number.
        </p>
      </LegalSection>

      <LegalSection title="Ask us to delete your data">
        <p>
          Email <MailLink email={contact} /> from the address on your Converszio account, with the subject &ldquo;Delete
          my data&rdquo;. Tell us whether you want everything deleted or only a connected WhatsApp account.
        </p>
        <p>
          We confirm receipt, then delete your account data, messages, contacts, templates and the access tokens we hold
          within 30 days. We keep only what the law requires, such as invoices, and tell you when it&apos;s done.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
