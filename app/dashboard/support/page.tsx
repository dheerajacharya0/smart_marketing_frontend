"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, LifeBuoy, Mail, Send, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { StatusPill } from "@/components/status-pill"
import { useAccountId } from "@/hooks/use-account-id"
import { useSupportTickets, queryKeys } from "@/hooks/use-queries"
import { useQueryClient } from "@tanstack/react-query"
import { getErrorMessage } from "@/lib/errors"
import { env } from "@/lib/env"
import { createSupportTicket, type SupportTicketCategory } from "@/services/api"

/**
 * Help & Support.
 *
 * Used to present a support-ticket form that collected a category, subject,
 * description and attachment, sent none of it anywhere, and told the user
 * "Your support ticket has been submitted successfully." Then fixed to an
 * honest `mailto:` link instead, since there was no ticketing backend to send
 * the form to.
 *
 * Now there is one (`SupportModule` on the backend) — tickets are created,
 * stored, and tracked by status here. Replies still go out over email (not an
 * in-app thread yet), so the `NEXT_PUBLIC_SUPPORT_EMAIL` card stays, but as the
 * fallback for when there's no account to file a ticket against or the
 * request fails, not as the primary path.
 */

const CATEGORIES: { value: SupportTicketCategory; label: string }[] = [
  { value: "billing", label: "Billing" },
  { value: "template_rejected", label: "Template rejected" },
  { value: "whatsapp_connection", label: "WhatsApp connection" },
  { value: "messaging_limits", label: "Messaging limits" },
  { value: "other", label: "Other" },
]

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
      "Meta caps how many new people each number can message in a rolling 24-hour window, based on your messaging tier. New numbers start low and the limit rises automatically as you send consistently and keep your quality rating healthy. If a campaign hits the cap it pauses and resumes on its own. Nobody is dropped.",
  },
]

export default function SupportPage() {
  const supportEmail = env.NEXT_PUBLIC_SUPPORT_EMAIL
  const { accountId, resolved } = useAccountId()
  const queryClient = useQueryClient()
  const { data: tickets, isLoading: isLoadingTickets } = useSupportTickets(accountId)

  const [category, setCategory] = useState<SupportTicketCategory>("billing")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const canSubmit = Boolean(accountId) && subject.trim().length >= 3 && description.trim().length > 0

  const submit = async () => {
    if (!accountId || !canSubmit || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await createSupportTicket({
        accountId,
        category,
        subject: subject.trim(),
        description: description.trim(),
      })
      setSubject("")
      setDescription("")
      await queryClient.invalidateQueries({ queryKey: queryKeys.supportTickets(accountId) })
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Couldn't file the ticket"))
    } finally {
      setSubmitting(false)
    }
  }

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
              <CardTitle>File a ticket</CardTitle>
              <CardDescription>We&apos;ll follow up by email on the address on your account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!resolved ? null : !accountId ? (
                <EmptyState
                  icon={Ticket}
                  title="No account to file this against"
                  description="Connect a WhatsApp account first, then come back here to open a ticket."
                  plain
                />
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="ticket-category">Category</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as SupportTicketCategory)}>
                      <SelectTrigger id="ticket-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ticket-subject">Subject</Label>
                    <Input
                      id="ticket-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Short summary of the problem"
                      maxLength={200}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ticket-description">What's going on?</Label>
                    <Textarea
                      id="ticket-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Include your account email and, if it's about a campaign or message, the number involved."
                      rows={5}
                      maxLength={5000}
                    />
                  </div>
                  {submitError && (
                    <Alert variant="destructive">
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  )}
                  <Button onClick={submit} disabled={!canSubmit || submitting}>
                    <Send className="mr-2 h-4 w-4" />
                    {submitting ? "Filing…" : "File ticket"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {accountId && (
            <Card>
              <CardHeader>
                <CardTitle>Your tickets</CardTitle>
                <CardDescription>Status updates as we work through them.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTickets ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : !tickets || tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tickets filed yet.</p>
                ) : (
                  <div className="space-y-3">
                    {tickets.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="font-medium">{t.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category} ·{" "}
                            {new Date(t.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <StatusPill status={t.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
              <CardTitle>Email us directly</CardTitle>
              <CardDescription>For anything that doesn&apos;t fit a ticket.</CardDescription>
            </CardHeader>
            <CardContent className={supportEmail ? undefined : "p-0"}>
              {supportEmail ? (
                <div className="space-y-4">
                  <Button asChild variant="outline" className="w-full">
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
