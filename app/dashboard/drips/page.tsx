"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Clock, Mails, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { AutomationPickerNote } from "@/components/automation-picker-note"
import { InsightBanner } from "@/components/insight-banner"
import { Explain } from "@/components/explain"
import { dripsInsight } from "@/lib/insights"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable, type Column } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
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
  listDrips,
  getDrip,
  updateDrip,
  deleteDrip,
  type DripSequence,
  type WhatsappContext,
} from "@/services/api"
import { EnrollDialog } from "./enroll-dialog"

export default function DripsPage() {
  const router = useRouter()
  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [drips, setDrips] = useState<DripSequence[]>([])
  const [counts, setCounts] = useState<Record<string, { active: number; completed: number }>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [enrollDripId, setEnrollDripId] = useState<string | null>(null)

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
        if (!ctx) setIsLoading(false)
      } catch (err) {
        console.error("Failed to resolve WhatsApp context:", err)
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const fetchDrips = useCallback(async () => {
    if (!context) return
    setIsLoading(true)
    try {
      const res = await listDrips(context.accountId)
      const drips = Array.isArray(res) ? res : []
      setDrips(drips)
      // Lazy-load live enrollment counts per row (list endpoint omits them)
      drips.forEach(async (d) => {
        try {
          const detail = await getDrip(d.id, context.accountId)
          const enrollments = detail?.enrollments
          if (enrollments) {
            setCounts((prev) => ({ ...prev, [d.id]: enrollments }))
          }
        } catch {
          // leave as "—"
        }
      })
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to load sequences")
    } finally {
      setIsLoading(false)
    }
  }, [context])

  useEffect(() => {
    fetchDrips()
  }, [fetchDrips])

  // Enrollment counts arrive per row, after the list; folding them in here
  // means the banner appears once they land rather than not at all.
  const insight = useMemo(
    () =>
      dripsInsight({
        drips: drips.map((drip) => ({
          ...drip,
          ...(counts[drip.id] ? { enrollments: counts[drip.id] } : {}),
        })),
      }),
    [drips, counts],
  )

  const handleToggleActive = async (drip: DripSequence, next: boolean) => {
    if (!context) return
    setBusyId(drip.id)
    try {
      await updateDrip(drip.id, { accountId: context.accountId, isActive: next })
      setDrips((prev) => prev.map((d) => (d.id === drip.id ? { ...d, isActive: next } : d)))
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to update sequence")
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (drip: DripSequence) => {
    if (!context) return
    setBusyId(drip.id)
    try {
      await deleteDrip(drip.id, context.accountId)
      toast.success("Sequence deleted")
      fetchDrips()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to delete sequence")
    } finally {
      setBusyId(null)
    }
  }

  // One definition drives the desktop table and the phone card list.
  const columns: Column<DripSequence>[] = [
    {
      key: "name",
      header: "Name",
      card: "title",
      sortValue: (d) => d.name,
      cell: (drip) => (
        <div>
          <span className="font-medium">{drip.name}</span>
          {drip.description && (
            <p className="max-w-56 truncate text-xs text-muted-foreground">{drip.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "trigger",
      header: "Trigger",
      card: "meta",
      sortValue: (d) => (d.triggerType === "tag" ? d.triggerTag ?? "" : "Manual"),
      cell: (drip) =>
        drip.triggerType === "tag" ? (
          <Badge variant="outline">Tag: {drip.triggerTag}</Badge>
        ) : (
          <Badge variant="outline">Manual</Badge>
        ),
    },
    {
      key: "steps",
      header: "Steps",
      cardLabel: "Steps",
      sortValue: (d) => d.steps?.length ?? 0,
      cell: (drip) => (
        <span className="inline-flex items-center gap-1 text-sm">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          {drip.steps?.length ?? 0}
        </span>
      ),
    },
    {
      key: "active",
      header: "Active",
      cardLabel: "Active",
      sortValue: (d) => (d.isActive ? 0 : 1),
      cell: (drip) => (
        <Switch
          checked={drip.isActive}
          disabled={busyId === drip.id}
          onCheckedChange={(v) => handleToggleActive(drip, v)}
        />
      ),
    },
    {
      key: "enrollments",
      header: "Enrollments",
      cardLabel: "Enrolled",
      // Counts arrive per-row after the list loads, so an un-fetched row sorts
      // last rather than pretending to be zero.
      sortValue: (d) => counts[d.id]?.active ?? null,
      cell: (drip) => {
        const c = counts[drip.id]
        return c ? (
          <span className="text-sm">
            <span className="font-medium">{c.active}</span> active ·{" "}
            <span className="text-muted-foreground">{c.completed} done</span>
          </span>
        ) : (
          <Skeleton className="h-4 w-24" />
        )
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      card: "actions",
      cell: (drip) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            title="Enroll contacts"
            onClick={() => setEnrollDripId(drip.id)}
          >
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" title="Enrollments" asChild>
            <Link href={`/dashboard/drips/${drip.id}/enrollments`}>
              <Users className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" title="Edit" asChild>
            <Link href={`/dashboard/drips/${drip.id}/edit`}>
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                title="Delete"
                disabled={busyId === drip.id}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &quot;{drip.name}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>
                  Active enrollments stop immediately. This can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(drip)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drip Sequences"
        description="Automated message series sent to contacts on a schedule after they join."
        actions={
          <Button onClick={() => router.push("/dashboard/drips/new")} disabled={!context}>
            <Plus className="mr-2 h-4 w-4" /> New Sequence
          </Button>
        }
      />

      <AutomationPickerNote current="drip" />

      <InsightBanner insight={insight} />

      <Card>
        <CardHeader>
          <CardTitle>All sequences</CardTitle>
          <CardDescription>
            A <Explain term="drip">drip</Explain> runs per-contact, timed from each contact&apos;s
            own enrollment moment. Only <Explain term="opt-in">opted-in</Explain> contacts receive
            messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && context && drips.length === 0 ? (
            <EmptyState
              icon={Mails}
              title="No sequences yet"
              description="A drip sequence is an automated message series sent to contacts on a schedule after they join — e.g. Welcome now, a tip after a day, an offer after a week."
              action={
                <Button onClick={() => router.push("/dashboard/drips/new")}>
                  <Plus className="mr-2 h-4 w-4" /> New Sequence
                </Button>
              }
              hint="Each contact moves through the steps on their own clock, starting the moment they enroll."
            />
          ) : (
            <DataTable
              columns={columns}
              rows={drips}
              getRowKey={(drip) => drip.id}
              isLoading={isLoading}
              skeletonRows={3}
              empty={
                <EmptyState
                  plain
                  icon={Mails}
                  title="No registered WhatsApp number yet"
                  description="Finish the WhatsApp setup flow before building a sequence."
                  action={
                    <Button asChild>
                      <Link href="/dashboard/whatsapp">Go to WhatsApp setup</Link>
                    </Button>
                  }
                />
              }
            />
          )}
        </CardContent>
      </Card>

      {context && enrollDripId && (
        <EnrollDialog
          open={!!enrollDripId}
          onOpenChange={(open) => !open && setEnrollDripId(null)}
          dripId={enrollDripId}
          accountId={context.accountId}
          steps={drips.find((d) => d.id === enrollDripId)?.steps ?? []}
          onEnrolled={fetchDrips}
        />
      )}
    </div>
  )
}
