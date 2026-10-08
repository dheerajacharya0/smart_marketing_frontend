import type { Metadata } from "next"
import Link from "next/link"
import { LEGAL_ENTITY, LegalPage, LegalSection, MailLink, legalContactEmail } from "@/components/landing/legal-page"

export const metadata: Metadata = {
  title: "Privacy — Converszio",
  description: "How Converszio collects, uses and protects data, including data received from Meta and WhatsApp.",
}

/**
 * The privacy policy linked from the Meta app (Login dialog, App Review). It has
 * to say what we receive from Meta and what we do with it, so every claim here
 * should match the product: change the code, change this page.
 */
export default function PrivacyPage() {
  const contact = legalContactEmail()
  return (
    <LegalPage title="Privacy policy" updated="8 October 2026">
      <LegalSection title="Who we are">
        <p>
          Converszio is a WhatsApp Business messaging platform operated by {LEGAL_ENTITY}, India (&ldquo;we&rdquo;,
          &ldquo;us&rdquo;). Businesses use it to connect their WhatsApp Business account, talk to their customers, send
          approved message templates and run campaigns. This policy covers the Converszio website and dashboard.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <p>
          <strong>Account data.</strong> Your name, email address and password (stored only as a hash), and the team
          members you invite.
        </p>
        <p>
          <strong>Data from Meta, when you connect WhatsApp.</strong> When you sign in with Facebook to connect a WhatsApp
          Business account, Meta gives us an access token and the permissions you approve. With them we read your
          Facebook user ID and name, the businesses and WhatsApp Business accounts you choose to share, their phone
          numbers, display names, quality ratings and message templates.
        </p>
        <p>
          <strong>Messages and contacts.</strong> Messages and media sent and received through your connected numbers,
          delivery and read statuses, call events, and the contacts you import or that message you. If you connect a
          number that also runs the WhatsApp Business app, recent chat history and contacts you choose to sync.
        </p>
        <p>
          <strong>Billing data.</strong> Wallet top-ups and invoices. Card and bank details are handled by our payment
          provider; we never see or store them.
        </p>
        <p>
          <strong>Technical data.</strong> IP address, browser type and error reports, used to keep the service running
          and secure.
        </p>
      </LegalSection>

      <LegalSection title="How we use it">
        <p>
          Only to provide Converszio to you: to send and receive WhatsApp messages on your behalf, show your inbox and
          analytics, manage your templates and phone numbers, run the campaigns and automations you set up, bill for usage,
          and support you. Message drafts you ask our AI assistant to write are generated from the description you type and
          your existing approved templates.
        </p>
        <p>
          We do not sell your data, use your customers&apos; messages or contacts for our own marketing, or share them
          with anyone except the service providers below. Data received from Meta is used only as Meta&apos;s Platform
          Terms allow.
        </p>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>We share data only with providers that run part of the service for us:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Meta Platforms (WhatsApp Business Platform) — sending and receiving messages</li>
          <li>Railway and Vercel — hosting and databases</li>
          <li>Amazon S3-compatible storage — keeping copies of message media</li>
          <li>Razorpay — payments</li>
          <li>Resend — account and notification emails</li>
          <li>Sentry — error reports</li>
          <li>Google (Gemini) and Anthropic — drafting message templates when you use the AI assistant</li>
          <li>Shopify — only if you connect your store, to sync orders and customers</li>
        </ul>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          For as long as your account is active. When you delete a connected WhatsApp account or your Converszio account,
          or ask us to, we delete the related data within 30 days, except records we must keep by law (such as invoices).
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <p>
          You can disconnect WhatsApp at any time from the dashboard, and remove Converszio&apos;s access in your Facebook
          settings under Business Integrations. You can ask for a copy of your data, a correction, or deletion — see{" "}
          <Link href="/data-deletion" className="font-medium text-lp-accent underline-offset-4 hover:underline">
            data deletion
          </Link>{" "}
          or write to <MailLink email={contact} />.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Data is encrypted in transit, access tokens are kept on our servers and never sent to your browser, and access
          inside a workspace is limited by team roles.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          We use cookies only to keep you signed in. The public website sets no tracking cookies and remembers your
          light/dark choice in your own browser.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          We will post changes here and update the date above. Questions: <MailLink email={contact} />.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
