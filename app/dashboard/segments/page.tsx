"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Filter, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
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
import { listSegments, deleteSegment, type Segment } from "@/services/api"
import { useAccountId } from "@/hooks/use-account-id"

export default function SegmentsPage() {
  const router = useRouter()
  const { accountId, resolved } = useAccountId()
  const [segments, setSegments] = useState<Segment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchSegments = useCallback(async () => {
    if (!accountId) return
    setIsLoading(true)
    try {
      const res = await listSegments(accountId)
      setSegments(Array.isArray(res) ? res : [])
    } catch (err: any) {
      toast.error(err?.message || "Failed to load segments")
    } finally {
      setIsLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    if (resolved && !accountId) setIsLoading(false)
    fetchSegments()
  }, [fetchSegments, resolved, accountId])

  const handleDelete = async (segment: Segment) => {
    if (!accountId) return
    setDeletingId(segment.id)
    try {
      await deleteSegment(segment.id, accountId)
      toast.success("Segment deleted")
      fetchSegments()
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete segment")
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Segments"
        description="Saved audience filters, evaluated live whenever they're used."
        actions={
          <Button onClick={() => router.push("/dashboard/segments/new")} disabled={!accountId}>
            <Plus className="mr-2 h-4 w-4" /> New Segment
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Segments</CardTitle>
          <CardDescription>Member counts are computed live per request.</CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && accountId && segments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-accent p-3 mb-3">
                <Filter className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-medium">No segments yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md text-center">
                A segment is a saved filter over your contacts — by tags, attributes, activity or campaign
                behavior. Its members are recomputed live, so it never goes stale. Use one as a campaign
                audience.
              </p>
              <Button onClick={() => router.push("/dashboard/segments/new")}>
                <Plus className="mr-2 h-4 w-4" /> New Segment
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell />
                      </TableRow>
                    ))
                  ) : !accountId ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No connected account yet — link a Facebook/WhatsApp account first.
                      </TableCell>
                    </TableRow>
                  ) : (
                    segments.map((segment) => (
                      <TableRow
                        key={segment.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/dashboard/segments/${segment.id}`)}
                      >
                        <TableCell className="font-medium">{segment.name}</TableCell>
                        <TableCell className="max-w-64 truncate text-sm text-muted-foreground">
                          {segment.description || "—"}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            {segment.memberCount ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(segment.createdAt)}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" title="View members" asChild>
                              <Link href={`/dashboard/segments/${segment.id}`}>
                                <Users className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" title="Edit" asChild>
                              <Link href={`/dashboard/segments/${segment.id}/edit`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Delete"
                                  disabled={deletingId === segment.id}
                                  className="text-destructive hover:text-destructive"
                                >
                                  {deletingId === segment.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{segment.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Contacts are not affected — only the saved filter is removed. This can't be
                                    undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(segment)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
