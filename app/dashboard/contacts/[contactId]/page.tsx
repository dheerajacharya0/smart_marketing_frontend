"use client"

import { use, useMemo } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  MessageSquare,
  Tag,
  UserCheck,
  UserX,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Explain } from "@/components/explain"
import { useAccountId } from "@/hooks/use-account-id"
import { useContact, useConversations } from "@/hooks/use-queries"
import {
  OPT_IN_SOURCE_LABELS,
  formatOptTimestamp,
  optedOutViaStop,
} from "@/lib/contact-consent"
import { ContactTimeline } from "./contact-timeline"
import { ContactActivity } from "./contact-activity"

/**
 * Contact profile — one page holding everything the product actually knows
 * about a person: who they are, what consent you hold, and the full message
 * history with them.
 *
 * Before this, contact data was spread across a table row (identity, tags) and
 * the inbox (messages), with no way to get from one to the other. The list now
 * links here, and here links on to the thread.
 *
 * **What is deliberately absent:** campaign and drip history. Both exist only as
 * per-campaign (`listCampaignRecipients`) and per-drip (`listDripEnrollments`)
 * endpoints — there is no reverse index from a contact to the sends that touched
 * them. Building that view client-side would mean fanning out across every
 * campaign and every drip on the account, so it waits for a backend endpoint
 * rather than shipping as a slow half-answer or, worse, a fabricated one.
 */
export default function ContactProfilePage({
  params,
}: {
  params: Promise<{ contactId: string }>
}) {
  const { contactId } = use(params)
  const { accountId, resolved } = useAccountId()
  const contact = useContact(accountId, contactId)
  const conversations = useConversations(accountId)

  // No conversation-by-contact endpoint — match the account's threads on waId.
  const conversation = useMemo(() => {
    if (!contact.data) return undefined
    return (conversations.data ?? []).find((c) => c.contactWaId === contact.data.waId)
  }, [conversations.data, contact.data])

  if (resolved && !accountId) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={UserX}
          title="No connected account"
          description="Link a WhatsApp account before viewing contacts."
        />
      </div>
    )
  }

  if (contact.isLoading || !resolved) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64 md:col-span-1" />
          <Skeleton className="h-64 md:col-span-2" />
        </div>
      </div>
    )
  }

  // `useContact` has retry off, so an error here is settled — almost always a
  // 404 for an id that isn't on this account.
  if (contact.isError || !contact.data) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={AlertTriangle}
          title="Contact not found"
          description="This contact doesn't exist, or it belongs to a different account."
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard/contacts">Back to contacts</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const person = contact.data
  const displayName = person.name || `+${person.waId}`
  const attributes = Object.entries(person.attributes ?? {})
  const viaStop = optedOutViaStop(person)

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader
        title={displayName}
        description={person.name ? `+${person.waId}` : undefined}
        actions={
          conversation ? (
            <Button asChild>
              <Link href={`/dashboard/chat/${conversation.id}`}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Open conversation
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Consent
                <Explain term="opt-in" />
              </CardTitle>
              <CardDescription>Whether you may message this person</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {person.optedIn ? (
                <>
                  <Badge className="bg-success-soft text-success hover:bg-success-soft">
                    <UserCheck className="mr-1 h-3 w-3" />
                    Opted in
                  </Badge>
                  <dl className="space-y-1 text-sm">
                    <Row
                      label="How"
                      value={
                        person.optInSource
                          ? OPT_IN_SOURCE_LABELS[person.optInSource] ?? person.optInSource
                          : "Not recorded"
                      }
                    />
                    <Row label="When" value={formatOptTimestamp(person.optedInAt) ?? "Not recorded"} />
                  </dl>
                </>
              ) : !person.optedOutAt ? (
                <>
                  <Badge variant="outline" className="border-warning/40 text-warning">
                    No consent recorded
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Broadcasts reach this contact; drip sequences don&apos;t until you record an opt-in.
                  </p>
                </>
              ) : (
                <>
                  <Badge variant="secondary">
                    <UserX className="mr-1 h-3 w-3" />
                    Opted out
                  </Badge>
                  <dl className="space-y-1 text-sm">
                    <Row label="When" value={formatOptTimestamp(person.optedOutAt) ?? "Not recorded"} />
                  </dl>
                  {viaStop ? (
                    <p className="rounded-md border border-warning/25 bg-warning-soft p-3 text-xs text-warning">
                      This person unsubscribed themselves by texting STOP. Don&apos;t opt them back
                      in unless they ask you to — re-messaging someone who opted out is the
                      fastest way to damage your number&apos;s quality rating.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Campaigns and drips skip this contact automatically.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="h-4 w-4" />
                Tags &amp; attributes
              </CardTitle>
              <CardDescription>
                What you can filter and personalise on
                <Explain term="attribute" />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tags</p>
                {person.tags?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {person.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">None</p>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Attributes</p>
                {attributes.length ? (
                  <dl className="space-y-1 text-sm">
                    {attributes.map(([key, value]) => (
                      <Row key={key} label={key} value={value} />
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">None</p>
                )}
              </div>

              <dl className="border-t pt-3 text-sm">
                <Row label="Added" value={formatOptTimestamp(person.createdAt) ?? "—"} />
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <ContactActivity contactId={contactId} accountId={accountId} />
          <ContactTimeline
            accountId={accountId}
            conversationId={conversation?.id}
            conversationsLoading={conversations.isLoading}
          />
        </div>
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link href="/dashboard/contacts">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to contacts
      </Link>
    </Button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{value}</dd>
    </div>
  )
}
