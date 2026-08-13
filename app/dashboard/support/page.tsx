"use client"

import Link from "next/link"
import { ArrowLeft, LifeBuoy, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { env } from "@/lib/env"

/**
 * Help & Support.
 *
 * This page used to present a support-ticket form that collected a category,
 * subject, description, and attachment, sent none of it anywhere
 * (`// In a real app, you would submit the ticket to an API`), and then showed
 * **"Your support ticket has been submitted successfully."** A user hitting a
 * production problem would write it up, be told it was received, and wait for a
 * reply that was never coming. The contact card beside it listed
 * `support@example.com` and `+1 (555) 123-4567`.
 *
 * There is no ticketing backend, so the form is gone rather than faked. Email
 * is the honest channel, gated on `NEXT_PUBLIC_SUPPORT_EMAIL` — unset, the page
 * says contact isn't set up instead of offering an address that reaches nobody.
 */

const FAQS = [
  {
    question: "How do I reset my password?",
    answer:
      "Click 'Forgot Password' on the login page. Follow the instructions sent to your email to create a new password.",
  },
  {
    question: "Why was my message template rejected?",
    answer:
      "Templates get rejected for promotional content without opt-in, prohibited content, or formatting that doesn't follow WhatsApp's guidelines. Review the rejection reason, make the changes, and resubmit.",
  },
  {
    question: "How do I connect my WhatsApp Business Account?",
    answer:
      "Go to WhatsApp in the sidebar and click 'Connect WhatsApp'. That runs Meta's Embedded Signup, which links your Facebook Business Manager and WhatsApp Business Account in one flow.",
  },
  {
    question: "What are the messaging limits?",
    answer:
      "Meta caps how many new people each number can message in a rolling 24-hour window, based on your messaging tier. New numbers start low and the limit rises automatically as you send consistently and keep your quality rating healthy. If a campaign hits the cap it pauses and resumes on its own — nobody is dropped.",
  },
]

export default function SupportPage() {
  const supportEmail = env.NEXT_PUBLIC_SUPPORT_EMAIL

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
        <PageHeader title="Help & Support" description="Answers to common questions, and how to reach us." />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Frequently asked questions</CardTitle>
              <CardDescription>Quick answers to common questions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {FAQS.map((faq) => (
                  <div key={faq.question} className="border-b pb-4 last:border-0 last:pb-0">
                    <h4 className="mb-2 font-medium">{faq.question}</h4>
                    <p className="text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Contact support</CardTitle>
              <CardDescription>We&apos;ll get back to you by email</CardDescription>
            </CardHeader>
            <CardContent className={supportEmail ? undefined : "p-0"}>
              {supportEmail ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Include your account email and, if it&apos;s about a campaign or message, the
                    number involved — it&apos;s the fastest way to get a useful answer.
                  </p>
                  <Button asChild className="w-full">
                    <a href={`mailto:${supportEmail}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Email support
                    </a>
                  </Button>
                  <p className="break-all text-center text-xs text-muted-foreground">
                    {supportEmail}
                  </p>
                </div>
              ) : (
                <EmptyState
                  icon={LifeBuoy}
                  title="Support contact isn't set up yet"
                  description="No support address has been configured for this deployment, so there's nowhere to route a request right now. If you're running this instance, set NEXT_PUBLIC_SUPPORT_EMAIL."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
