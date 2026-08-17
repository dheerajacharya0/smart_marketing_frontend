"use client"

import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, UserPlus, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import { StatStrip } from "@/components/stat-strip"
import { EmptyState } from "@/components/empty-state"
import { DataTable, type Column } from "@/components/data-table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "react-hot-toast"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getDrip,
  listDripEnrollments,
  cancelDripEnrollment,
  type DripEnrollment,
  type DripEnrollmentStatus,
  type DripExitReason,
  type DripSequence,
  type WhatsappContext,
} from "@/services/api"
import { EnrollDialog } from "../../enroll-dialog"

const PAGE_SIZE = 20

type StatusTab = "all" | DripEnrollmentStatus
const TILE_STATUSES: DripEnrollmentStatus[] = ["active", "completed", "cancelled", "stopped"]

function EnrollmentStatusBadge({ status }: { status: DripEnrollmentStatus }) {
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
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>
    case "stopped":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-400">
          Stopped
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

/**
 * Why an enrollment ended, in the customer's words. The first four are the
 * sequence doing its job — a contact who answered shouldn't keep receiving
 * follow-ups — and read as neutral or good; the rest are the sequence being cut
 * short by something else.
 */
const EXIT_REASON_LABELS: Record<DripExitReason, string> = {
  replied: "They replied",
  button_clicked: "They tapped a button",
  tag_added: "A tag was added",
  tag_removed: "A tag was removed",
  opted_out: "They opted out",
  contact_deleted: "Contact deleted",
  sequence_inactive: "Sequence turned off",
  send_failed: "A message failed",
}

const EXIT_REASON_TONE: Partial<Record<DripExitReason, string>> = {
  replied: "text-green-700 dark:text-green-400",
  button_clicked: "text-green-700 dark:text-green-400",
  opted_out: "text-destructive",
  send_failed: "text-destructive",
}

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60000)
  const future = diff > 0
  const fmt = (n: number, unit: string) => `${future ? "in " : ""}${n} ${unit}${n === 1 ? "" : "s"}${future ? "" : " ago"}`
  if (mins < 60) return fmt(Math.max(mins, 1), "min")
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return fmt(hrs, "hour")
  return fmt(Math.round(hrs / 24), "day")
}

export default function DripEnrollmentsPage() {
  const params = useParams<{ dripId: string }>()
  const dripId = params.dripId
  const router = useRouter()

  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [drip, setDrip] = useState<DripSequence | null>(null)
  const [tiles, setTiles] = useState<Record<string, number>>({})
  const [enrollments, setEnrollments] = useState<DripEnrollment[]>([])
  const [total, setTotal] = useState(0)
  const [statusTab, setStatusTab] = useState<StatusTab>("all")
  const [offset, setOffset] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [showEnroll, setShowEnroll] = useState(false)

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
        if (ctx && dripId) {
          const res = await getDrip(dripId, ctx.accountId)
          setDrip(res)
        }
      } catch (err) {
        toast.error(getErrorMessage(err) || "Failed to load sequence")
        setIsLoading(false)
      }
    }
    init()
  }, [dripId])

  // Tile totals — one lightweight limit=1 query per status.
  const fetchTiles = useCallback(async () => {
    if (!context) return
    const entries = await Promise.all(
      TILE_STATUSES.map(async (status) => {
        try {
          const res = await listDripEnrollments(dripId, context.accountId, { status, limit: 1 })
          return [status, res.total ?? 0] as const
        } catch {
          return [status, 0] as const
        }
      })
    )
    setTiles(Object.fromEntries(entries))
  }, [context, dripId])

  const fetchEnrollments = useCallback(async () => {
    if (!context) return
    setIsLoading(true)
    try {
      const res = await listDripEnrollments(dripId, context.accountId, {
        status: statusTab === "all" ? undefined : statusTab,
        limit: PAGE_SIZE,
        offset,
      })
      setEnrollments(Array.isArray(res.items) ? res.items : [])
      setTotal(res.total ?? 0)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to load enrollments")
    } finally {
      setIsLoading(false)
    }
  }, [context, dripId, statusTab, offset])

  useEffect(() => {
    fetchEnrollments()
  }, [fetchEnrollments])
  useEffect(() => {
    fetchTiles()
  }, [fetchTiles])

  const handleCancel = async (enrollment: DripEnrollment) => {
    if (!context) return
    setCancellingId(enrollment.id)
    try {
      await cancelDripEnrollment(dripId, enrollment.id, context.accountId)
      toast.success("Enrollment cancelled")
      fetchEnrollments()
      fetchTiles()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to cancel")
    } finally {
      setCancellingId(null)
    }
  }

  const stepCount = drip?.steps?.length ?? 0
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, total)

  const columns: Column<DripEnrollment>[] = [
    {
      key: "contact",
      header: "Contact",
      className: "whitespace-nowrap",
      cell: (e) =>
        e.conversationId ? (
          <Link href={`/dashboard/chat/${e.conversationId}`} className="hover:underline">
            +{e.waId}
          </Link>
        ) : (
          <>+{e.waId}</>
        ),
    },
    { key: "status", header: "Status", cell: (e) => <EnrollmentStatusBadge status={e.status} /> },
    {
      key: "progress",
      header: "Progress",
      className: "whitespace-nowrap text-sm",
      cell: (e) =>
        `Step ${Math.min(e.currentStepIndex + 1, stepCount || e.currentStepIndex + 1)}${
          stepCount ? ` of ${stepCount}` : ""
        }`,
    },
    {
      key: "next",
      header: "Next send",
      className: "whitespace-nowrap text-sm text-muted-foreground hide-on-sm",
      cell: (e) =>
        e.status === "active" && e.nextStepAt ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">{relativeTime(e.nextStepAt)}</span>
              </TooltipTrigger>
              <TooltipContent>{new Date(e.nextStepAt).toLocaleString()}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          "—"
        ),
    },
    { key: "sent", header: "Sent", className: "text-sm hide-on-md", cell: (e) => e.sentCount },
    {
      key: "exit",
      header: "Why it ended",
      className: "text-sm hide-on-md",
      // "Stopped" alone conflates the sequence working (they replied) with it
      // failing (they opted out). The reason is the only thing that separates
      // them, so it gets its own column rather than a tooltip.
      cell: (e) =>
        e.exitReason ? (
          <span className={EXIT_REASON_TONE[e.exitReason] ?? "text-muted-foreground"}>
            {EXIT_REASON_LABELS[e.exitReason] ?? e.exitReason}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "issue",
      header: "Issue",
      className: "max-w-48 hide-on-lg",
      cell: (e) =>
        e.lastError ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block truncate text-sm text-destructive cursor-help">{e.lastError}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm whitespace-pre-wrap">{e.lastError}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (e) =>
        e.status === "active" ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                title="Cancel enrollment"
                disabled={cancellingId === e.id}
                className="text-destructive hover:text-destructive"
              >
                {cancellingId === e.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this enrollment?</AlertDialogTitle>
                <AlertDialogDescription>
                  +{e.waId} stops receiving the remaining steps. Already-sent messages are unaffected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep active</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleCancel(e)}>Cancel enrollment</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/drips")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to sequences
        </Button>
        <PageHeader
          title={`Enrollments${drip ? ` — ${drip.name}` : ""}`}
          actions={
            <Button onClick={() => setShowEnroll(true)} disabled={!context}>
              <UserPlus className="mr-2 h-4 w-4" /> Enroll contacts
            </Button>
          }
        />
      </div>

      <StatStrip
        stats={TILE_STATUSES.map((status) => ({
          label: status.charAt(0).toUpperCase() + status.slice(1),
          value: tiles[status] ?? "—",
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Enrolled contacts</CardTitle>
          <CardDescription>
            Each contact moves through the steps on their own schedule. Only opted-in contacts receive
            messages; a contact who opts out is stopped automatically.
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
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              <TabsTrigger value="stopped">Stopped</TabsTrigger>
            </TabsList>
          </Tabs>

          <DataTable
            columns={columns}
            rows={enrollments}
            getRowKey={(e) => e.id}
            isLoading={isLoading}
            skeletonRows={6}
            empty={
              <EmptyState
                icon={UserPlus}
                title={statusTab !== "all" ? "No enrollments in this status" : "No enrollments yet"}
                description="Enroll contacts to start moving them through this sequence."
                action={
                  <Button onClick={() => setShowEnroll(true)} disabled={!context}>
                    <UserPlus className="mr-2 h-4 w-4" /> Enroll contacts
                  </Button>
                }
              />
            }
          />

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

      {context && (
        <EnrollDialog
          open={showEnroll}
          onOpenChange={setShowEnroll}
          dripId={dripId}
          accountId={context.accountId}
          onEnrolled={() => {
            fetchEnrollments()
            fetchTiles()
          }}
        />
      )}
    </div>
  )
}
