"use client"

import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Clock, Loader2, Mails, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { AutomationPickerNote } from "@/components/automation-picker-note"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

      <Card>
        <CardHeader>
          <CardTitle>All Sequences</CardTitle>
          <CardDescription>
            A drip runs per-contact, timed from each contact's own enrollment moment. Only opted-in contacts
            receive messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && context && drips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-accent p-3 mb-3">
                <Mails className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-medium">No sequences yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md text-center">
                A drip sequence is an automated message series sent to contacts on a schedule after they join —
                e.g. Welcome now, a tip after a day, an offer after a week.
              </p>
              <Button onClick={() => router.push("/dashboard/drips/new")}>
                <Plus className="mr-2 h-4 w-4" /> New Sequence
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Steps</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Enrollments</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : !context ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No registered WhatsApp number yet — finish the WhatsApp setup flow first.
                      </TableCell>
                    </TableRow>
                  ) : (
                    drips.map((drip) => {
                      const c = counts[drip.id]
                      return (
                        <TableRow key={drip.id}>
                          <TableCell className="font-medium">
                            {drip.name}
                            {drip.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-56">{drip.description}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {drip.triggerType === "tag" ? (
                              <Badge variant="outline">Tag: {drip.triggerTag}</Badge>
                            ) : (
                              <Badge variant="outline">Manual</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-sm">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {drip.steps?.length ?? 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={drip.isActive}
                              disabled={busyId === drip.id}
                              onCheckedChange={(v) => handleToggleActive(drip, v)}
                            />
                          </TableCell>
                          <TableCell>
                            {c ? (
                              <span className="text-sm">
                                <span className="font-medium">{c.active}</span> active ·{" "}
                                <span className="text-muted-foreground">{c.completed} done</span>
                              </span>
                            ) : (
                              <Skeleton className="h-4 w-24" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
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
                                    <AlertDialogTitle>Delete "{drip.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Active enrollments stop immediately. This can't be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(drip)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {context && enrollDripId && (
        <EnrollDialog
          open={!!enrollDripId}
          onOpenChange={(open) => !open && setEnrollDripId(null)}
          dripId={enrollDripId}
          accountId={context.accountId}
          onEnrolled={fetchDrips}
        />
      )}
    </div>
  )
}
