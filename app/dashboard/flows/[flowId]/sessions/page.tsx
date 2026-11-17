"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, Inbox } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
import { LoadFailed } from "@/components/load-failed"
import { useActiveNumber } from "@/hooks/use-active-number"
import { Explain } from "@/components/explain"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import {
  getFlow,
  listFlowSessions,
  type Flow,
  type FlowSession,
} from "@/services/api"

const PAGE_SIZE = 20

type StatusTab = "all" | FlowSession["status"]

/**
 * When a delayed session picks up again. A due-but-not-yet-resumed timer is
 * normal — the dispatcher scans on an interval — so a past time reads as
 * "any moment now" rather than as something stuck.
 */
function resumeLabel(resumeAt: string): string {
  const at = new Date(resumeAt)
  if (Number.isNaN(at.getTime())) return "waiting on a timer"
  const minutes = Math.round((at.getTime() - Date.now()) / 60000)
  if (minutes <= 0) return "resuming any moment"
  if (minutes < 60) return `resumes in ${minutes}m`
  const hours = Math.round(minutes / 60)
  return `resumes in ${hours}h`
}

function SessionStatusBadge({ status }: { status: FlowSession["status"] }) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-info-soft text-info hover:bg-info-soft">
          Active
        </Badge>
      )
    case "completed":
      return (
        <Badge className="bg-success-soft text-success hover:bg-success-soft">
          Completed
        </Badge>
      )
    case "handed_off":
      return (
        <Badge className="bg-warning-soft text-warning hover:bg-warning-soft">
          Handed off
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function FlowSessionsPage() {
  const params = useParams<{ flowId: string }>()
  const flowId = params.flowId
  const router = useRouter()

  const {
    active: context,
    error: contextError,
    pending: contextPending,
    retry: retryContext,
  } = useActiveNumber()
  const accountId = context?.accountId
  const [flow, setFlow] = useState<Flow | null>(null)
  const [sessions, setSessions] = useState<FlowSession[]>([])
  const [total, setTotal] = useState(0)
  const [statusTab, setStatusTab] = useState<StatusTab>("all")
  const [offset, setOffset] = useState(0)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionsError, setSessionsError] = useState<string | null>(null)

  // The flow only feeds the header; a failure there is a toast and the list
  // below still loads.
  useEffect(() => {
    if (!accountId || !flowId) return
    let cancelled = false
    getFlow(flowId, accountId)
      .then((res) => {
        if (!cancelled) setFlow(res)
      })
      .catch((err) => {
        if (!cancelled) toast.error(getErrorMessage(err) || "Failed to load flow")
      })
    return () => {
      cancelled = true
    }
  }, [accountId, flowId])

  // Only the latest request may write: switching tabs while one is in flight
  // must not let the older answer land under the newer tab.
  const latestRequest = useRef(0)
  const fetchSessions = useCallback(async () => {
    if (!accountId || !flowId) return
    const requestId = ++latestRequest.current
    setSessionsLoading(true)
    setSessionsError(null)
    try {
      const res = await listFlowSessions(flowId, accountId, {
        status: statusTab === "all" ? undefined : statusTab,
        limit: PAGE_SIZE,
        offset,
      })
      if (requestId !== latestRequest.current) return
      setSessions(Array.isArray(res.items) ? res.items : [])
      setTotal(res.total ?? 0)
    } catch (err) {
      if (requestId !== latestRequest.current) return
      // Kept apart from the rows: a failed read rendered as "No sessions yet"
      // (or as the previous tab's rows under this tab's label).
      setSessions([])
      setTotal(0)
      setSessionsError(getErrorMessage(err) || "Couldn't load sessions")
    } finally {
      if (requestId === latestRequest.current) setSessionsLoading(false)
    }
  }, [accountId, flowId, statusTab, offset])
  const isLoading = contextPending || (Boolean(context) && sessionsLoading)

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const formatDateTime = (iso: string) => new Date(iso).toLocaleString()

  // One definition drives the desktop table and the phone card list.
  const columns: Column<FlowSession>[] = [
    {
      key: "contact",
      header: "Contact",
      card: "title",
      className: "whitespace-nowrap",
      cell: (session) =>
        session.conversationId ? (
          <Link
            href={`/dashboard/chat/${session.conversationId}`}
            className="font-mono underline-offset-4 hover:underline"
          >
            +{session.contactWaId}
          </Link>
        ) : (
          <span className="font-mono">+{session.contactWaId}</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      card: "meta",
      cell: (session) => (
        <div className="flex flex-col items-start gap-1">
          <SessionStatusBadge status={session.status} />
          {/* A session on a delay timer is still `active` — the status
              can't tell you it's waiting on a clock rather than on the
              contact, only `resumeAt` can. */}
          {session.status === "active" && session.resumeAt && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {resumeLabel(session.resumeAt)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "node",
      header: "Current node",
      cardLabel: "Node",
      className: "hide-on-lg",
      cell: (session) =>
        session.currentNodeId ? (
          <Badge variant="outline" className="font-mono text-xs">
            {session.currentNodeId}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "variables",
      header: "Variables",
      cardLabel: "Answers",
      cell: (session) => (
        <div className="flex max-w-64 flex-wrap gap-1">
          {Object.entries(session.variables || {}).map(([k, v]) => (
            <Badge key={k} variant="secondary" className="text-xs">
              {k}: {v}
            </Badge>
          ))}
          {Object.keys(session.variables || {}).length === 0 && (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: "updated",
      header: "Last updated",
      cardLabel: "Updated",
      className: "whitespace-nowrap hide-on-md",
      cell: (session) => (
        <span className="text-sm text-muted-foreground">{formatDateTime(session.updatedAt)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/flows")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to flows
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">
          Sessions{flow ? `: ${flow.name}` : ""}
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flow Sessions</CardTitle>
          <CardDescription>
            Every contact who entered this <Explain term="flow">flow</Explain>, with their collected
            answers. One <Explain term="flow-session">session</Explain> per contact at a time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={statusTab}
            onValueChange={(v) => {
              setStatusTab(v as StatusTab)
              setOffset(0)
            }}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="handed_off">Handed off</TabsTrigger>
            </TabsList>
          </Tabs>

          <DataTable
            columns={columns}
            rows={sessions}
            getRowKey={(session) => session.id}
            isLoading={isLoading}
            skeletonRows={5}
            // Paged and filtered server-side: sorting here would only
            // reorder the current page.
            disableSorting
            error={
              !context && contextError ? (
                <LoadFailed message="Couldn't load your WhatsApp number." onRetry={() => void retryContext()} />
              ) : sessionsError ? (
                <LoadFailed message={sessionsError} onRetry={() => void fetchSessions()} />
              ) : undefined
            }
            empty={
              !context ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No registered WhatsApp number yet. Finish the WhatsApp setup flow first.
                </p>
              ) : (
              <EmptyState
                plain
                icon={Inbox}
                title={
                  statusTab === "all" ? "No sessions yet" : "Nothing in this status"
                }
                description={
                  statusTab === "all"
                    ? "A session starts the moment a contact triggers this flow."
                    : "Try another tab, sessions move between states as contacts reply."
                }
              />
              )
            }
            pagination={{
              offset,
              pageSize: PAGE_SIZE,
              total,
              onOffsetChange: setOffset,
              noun: "session",
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
