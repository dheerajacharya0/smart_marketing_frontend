"use client"

import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, Inbox } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getFlow,
  listFlowSessions,
  type Flow,
  type FlowSession,
  type WhatsappContext,
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

  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [sessions, setSessions] = useState<FlowSession[]>([])
  const [total, setTotal] = useState(0)
  const [statusTab, setStatusTab] = useState<StatusTab>("all")
  const [offset, setOffset] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) {
        setIsLoading(false)
        return
      }
      try {
        const ctx = await getActiveWhatsappContext()
        setContext(ctx)
        if (ctx && flowId) {
          const res = await getFlow(flowId, ctx.accountId)
          setFlow(res)
        }
      } catch (err) {
        toast.error(getErrorMessage(err) || "Failed to load flow")
        setIsLoading(false)
      }
    }
    init()
  }, [flowId])

  const fetchSessions = useCallback(async () => {
    if (!context || !flowId) return
    setIsLoading(true)
    try {
      const res = await listFlowSessions(flowId, context.accountId, {
        status: statusTab === "all" ? undefined : statusTab,
        limit: PAGE_SIZE,
        offset,
      })
      setSessions(Array.isArray(res.items) ? res.items : [])
      setTotal(res.total ?? 0)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to load sessions")
    } finally {
      setIsLoading(false)
    }
  }, [context, flowId, statusTab, offset])

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
          <span className="text-muted-foreground">—</span>
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
            <span className="text-sm text-muted-foreground">—</span>
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
          Sessions{flow ? ` — ${flow.name}` : ""}
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flow Sessions</CardTitle>
          <CardDescription>Every contact who entered this flow, with their collected answers.</CardDescription>
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
            empty={
              <EmptyState
                plain
                icon={Inbox}
                title={
                  statusTab === "all" ? "No sessions yet" : "Nothing in this status"
                }
                description={
                  statusTab === "all"
                    ? "A session starts the moment a contact triggers this flow."
                    : "Try another tab — sessions move between states as contacts reply."
                }
              />
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
