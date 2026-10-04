"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CallButton } from "@/components/calls/call-button"
import { useAccountId } from "@/hooks/use-account-id"
import { useActiveNumber } from "@/hooks/use-active-number"
import { useChatSocket } from "@/hooks/use-chat-socket"
import { missedCallsKey, useMarkCallsSeen } from "@/hooks/use-missed-calls"
import { callOutcome, callerLabel } from "@/lib/calls"
import { getErrorStatus } from "@/lib/errors"
import { formatDateTime } from "@/lib/format-date"
import { cn } from "@/lib/utils"
import { listCalls, type CallListFilters, type WhatsappCall } from "@/services/api"

type Filter = "all" | "missed" | "inbound" | "outbound"

const PAGE_SIZE = 50

const FILTERS: Record<Filter, CallListFilters> = {
  all: {},
  missed: { direction: "inbound", status: "missed" },
  inbound: { direction: "inbound" },
  outbound: { direction: "outbound" },
}

function CallIcon({ call }: { call: WhatsappCall }) {
  const { tone } = callOutcome(call)
  const Icon =
    call.direction === "outbound" ? PhoneOutgoing : tone === "missed" ? PhoneMissed : PhoneIncoming
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        tone === "missed" ? "bg-destructive/10 text-destructive" : "bg-whatsapp/10 text-whatsapp",
      )}
      aria-hidden="true"
    >
      <Icon className="h-4 w-4" />
    </span>
  )
}

function CallRow({ call, accountId }: { call: WhatsappCall; accountId: string }) {
  const outcome = callOutcome(call)
  const direction = call.direction === "outbound" ? "Outgoing" : "Incoming"
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
      <CallIcon call={call} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-medium", outcome.tone === "missed" && "text-destructive")}>
          {callerLabel(call)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {direction} · <span className={cn(outcome.tone === "missed" && "text-destructive")}>{outcome.label}</span>
          {call.customerName ? <span className="font-mono"> · +{call.customerWaId}</span> : null}
        </p>
      </div>
      <p className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDateTime(call.createdAt)}</p>
      <div className="flex shrink-0 items-center gap-1">
        {call.conversationId ? (
          <Button variant="ghost" size="icon-sm" asChild title="Open the chat">
            <Link href={`/dashboard/chat/${call.conversationId}`} aria-label={`Open the chat with ${callerLabel(call)}`}>
              <MessageSquare className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
        <CallButton
          variant="label"
          label={outcome.tone === "missed" ? "Call back" : "Call"}
          accountId={accountId}
          phoneNumberId={call.phoneNumberId}
          customerWaId={call.customerWaId}
          customerName={call.customerName}
          conversationId={call.conversationId}
        />
      </div>
    </li>
  )
}

/**
 * Every WhatsApp call on the account, newest first: who called, who was
 * called, what came of it, and a way to call back. Opening it clears the
 * missed-call badge.
 */
export default function CallsPage() {
  const { accountId } = useAccountId()
  // The log follows the number being worked on. Ringing and the missed-call
  // badge stay account-wide: a call on any number still needs answering.
  const { active } = useActiveNumber()
  const phoneNumberId = active?.phoneNumberId
  const queryClient = useQueryClient()
  const markSeen = useMarkCallsSeen()
  const [filter, setFilter] = useState<Filter>("all")
  const [limit, setLimit] = useState(PAGE_SIZE)

  useEffect(() => {
    if (accountId) markSeen(accountId)
  }, [accountId, markSeen])

  const queryKey = ["calls", accountId ?? "", filter, limit, phoneNumberId ?? ""] as const
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () => listCalls(accountId as string, { ...FILTERS[filter], limit, phoneNumberId }),
    enabled: Boolean(accountId),
    placeholderData: keepPreviousData,
    retry: false,
  })

  // A call starting, being answered or ending anywhere on the account.
  useChatSocket(
    accountId,
    useCallback(
      (msg) => {
        if (msg.type !== "call") return
        void queryClient.invalidateQueries({ queryKey: ["calls", accountId ?? ""] })
        // This page is open, so what's missed now has been seen.
        if (accountId) markSeen(accountId)
        void queryClient.invalidateQueries({ queryKey: missedCallsKey(accountId ?? "") })
      },
      [queryClient, accountId, markSeen],
    ),
  )

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const forbidden = getErrorStatus(error) === 403

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Calls"
        description="WhatsApp calls with your customers. Incoming calls ring every teammate who can see all conversations; the first to answer takes it."
      />

      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as Filter)
          setLimit(PAGE_SIZE)
        }}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="missed">Missed</TabsTrigger>
          <TabsTrigger value="inbound">Incoming</TabsTrigger>
          <TabsTrigger value="outbound">Outgoing</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {forbidden ? (
            <EmptyState
              plain
              icon={Phone}
              title="Calls aren't available to you"
              description="Only teammates who can see every conversation take and make calls. Ask an admin if you need access."
            />
          ) : isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              plain
              icon={filter === "missed" ? PhoneMissed : Phone}
              title={filter === "missed" ? "No missed calls" : "No calls yet"}
              description={
                filter === "missed"
                  ? "Every call that came in was picked up."
                  : "When a customer calls your WhatsApp number it rings here, and you can call anyone who has allowed it from their chat."
              }
            />
          ) : (
            <ul className="divide-y">
              {items.map((call) => (
                <CallRow key={call.id} call={call} accountId={accountId as string} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {items.length < total ? (
        <div className="flex justify-center">
          <Button variant="outline" disabled={isFetching || limit >= 200} onClick={() => setLimit((n) => Math.min(n + PAGE_SIZE, 200))}>
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {limit >= 200 ? "Showing the latest 200" : "Show more"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
