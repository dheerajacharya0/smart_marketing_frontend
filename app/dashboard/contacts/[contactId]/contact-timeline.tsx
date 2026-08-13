"use client"

import { useQuery } from "@tanstack/react-query"
import { MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { getChatMessages } from "@/services/api"
import { mapChatEvents, type ConversationMessage } from "@/hooks/use-chat-messages"

/**
 * Message history with one contact, newest first.
 *
 * Read-only on purpose — replying belongs in the inbox, which owns the 24-hour
 * window check, template picker and send path. Duplicating a composer here would
 * mean duplicating that window logic, and a second place to get it wrong.
 *
 * Messages are mapped with the inbox's own `mapChatEvents`, so media, templates,
 * interactive replies and Meta's "unsupported" type render identically in both
 * places rather than drifting apart.
 */

const PAGE_SIZE = 50

function formatWhen(date: Date): string {
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatusBadge({ message }: { message: ConversationMessage }) {
  if (message.sender !== "me" || !message.status) return null
  if (message.status === "failed") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        Failed{message.errorTitle ? `: ${message.errorTitle}` : ""}
      </Badge>
    )
  }
  return (
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
      {message.status}
    </span>
  )
}

export function ContactTimeline({
  accountId,
  conversationId,
  conversationsLoading,
}: {
  accountId: string | null | undefined
  /** Undefined when this contact has never had a conversation. */
  conversationId: string | undefined
  conversationsLoading: boolean
}) {
  const messages = useQuery({
    queryKey: ["contact-timeline", accountId ?? "", conversationId ?? ""],
    queryFn: async () => {
      const events = await getChatMessages(conversationId as string, accountId as string, undefined, PAGE_SIZE)
      // mapChatEvents sorts oldest-first for the inbox's bottom-anchored view;
      // a timeline reads newest-first.
      return mapChatEvents(Array.isArray(events) ? events : []).reverse()
    },
    enabled: Boolean(accountId && conversationId),
    staleTime: 30 * 1000,
  })

  const loading = conversationsLoading || (Boolean(conversationId) && messages.isLoading)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Message history</CardTitle>
        <CardDescription>
          {conversationId
            ? `Most recent ${PAGE_SIZE} messages, newest first. Reply from the inbox.`
            : "Everything you've exchanged with this person."}
        </CardDescription>
      </CardHeader>
      <CardContent className={conversationId ? undefined : "p-0"}>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !conversationId ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="You haven't exchanged any WhatsApp messages with this contact. A conversation starts when you send them an approved template, or when they message you first."
          />
        ) : messages.isError ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load this conversation just now — reload to try again.
          </p>
        ) : messages.data?.length ? (
          <ol className="space-y-4">
            {messages.data.map((message) => (
              <li key={message.id} className="flex gap-3">
                <div
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    message.sender === "me" ? "bg-primary" : "bg-muted-foreground/40"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium">
                      {message.sender === "me" ? "You sent" : "They sent"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatWhen(message.timestamp)}
                    </span>
                    {message.templateName && (
                      <Badge variant="outline" className="text-[10px]">
                        template: {message.templateName}
                      </Badge>
                    )}
                    <StatusBadge message={message} />
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.content}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">This conversation has no messages yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
