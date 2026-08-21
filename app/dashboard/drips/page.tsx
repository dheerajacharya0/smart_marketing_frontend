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
import { useDrips } from "@/hooks/use-queries"
import { reportSilent } from "@/lib/observability"
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
  const { data, isLoading, error, refetch } = useDrips(context?.accountId)
  // Memoised because it feeds a `useMemo` below: a fresh `[]` on every render
  // would recompute the insight every render.
  const drips: DripSequence[] = useMemo(() => (Array.isArray(data) ? data : []), [data])
  const loadError = error ? getErrorMessage(error, "Failed to load sequences") : null
  const [counts, setCounts] = useState<Record<string, { active: number; completed: number }>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [enrollDripId, setEnrollDripId] = useState<string | null>(null)

  // No `setIsLoading` bookkeeping here any more: the query is disabled until an
  // accountId exists, and a disabled query reports `isLoading: false` on its
  // own. The old version had to remember to stop its own spinner on all three
  // exits from this effect.
  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) return
      try {
        setContext(await getActiveWhatsappContext())
      } catch (err) {
        reportSilent(err, { source: "app/dashboard/drips/page.tsx", step: "resolve-context" })
      }
    }
    init()
  }, [])

  const fetchDrips = useCallback(() => {
    refetch()
  }, [refetch])

  // Enrollment counts are a second read per row — the list endpoint omits them.
  // Kept out of the query itself: one failed count must leave the other rows
  // and the list alone, which a single query result can't express.
  useEffect(() => {
    if (!context || drips.length === 0) return
    let cancelled = false
    drips.forEach(async (d) => {
      try {
        const detail = await getDrip(d.id, context.accountId)
        const enrollments = detail?.enrollments
        if (!cancelled && enrollments) {
          setCounts((prev) => ({ ...prev, [d.id]: enrollments }))
        }
      } catch (err) {
        // Leaves this row's count as "—". Breadcrumbed rather than silent, so a
        // detail endpoint failing for every row is discoverable.
        reportSilent(err, { source: "app/dashboard/drips/page.tsx", dripId: d.id })
      }
    })
    return () => {
      cancelled = true
    }
    // Keyed on the ids, not the array: a refetch returning the same sequences
    // must not re-fire a count request per row.
  }, [context, drips.map((d) => d.id).join(",")]) // eslint-disable-line react-hooks/exhaustive-deps

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
      refetch()
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
              error={
                loadError ? (
                  <EmptyState
                    plain
                    icon={Mails}
                    title="Couldn't load your sequences"
                    description={`${loadError}. Anyone already enrolled keeps moving through their steps — this is a problem reading the list, not running it.`}
                    action={
                      <Button variant="outline" onClick={() => refetch()}>
                        Try again
                      </Button>
                    }
                  />
                ) : undefined
              }
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
