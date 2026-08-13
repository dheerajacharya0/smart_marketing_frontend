"use client"

import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

function SessionStatusBadge({ status }: { status: FlowSession["status"] }) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400">
          Active
        </Badge>
      )
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
          Completed
        </Badge>
      )
    case "handed_off":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400">
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
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, total)

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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current node</TableHead>
                  <TableHead>Variables</TableHead>
                  <TableHead>Last updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No sessions{statusTab !== "all" ? " in this status" : " yet"}.
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap">
                        {s.conversationId ? (
                          <Link href={`/dashboard/chat/${s.conversationId}`} className="hover:underline">
                            +{s.contactWaId}
                          </Link>
                        ) : (
                          <>+{s.contactWaId}</>
                        )}
                      </TableCell>
                      <TableCell>
                        <SessionStatusBadge status={s.status} />
                      </TableCell>
                      <TableCell>
                        {s.currentNodeId ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {s.currentNodeId}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-64">
                          {Object.entries(s.variables || {}).map(([k, v]) => (
                            <Badge key={k} variant="secondary" className="text-xs">
                              {k}: {v}
                            </Badge>
                          ))}
                          {Object.keys(s.variables || {}).length === 0 && (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(s.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {total > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {from}–{to} of {total}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0 || isLoading}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= total || isLoading}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
