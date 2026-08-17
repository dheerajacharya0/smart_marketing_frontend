"use client"

import { useEffect } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useSegments, queryKeys } from "@/hooks/use-queries"
import { Filter, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { Explain } from "@/components/explain"
import { StarterLibrary } from "@/components/starter-library"
import { SEGMENT_STARTERS } from "@/lib/segment-starters"
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
import { deleteSegment, type Segment } from "@/services/api"
import { useAccountId } from "@/hooks/use-account-id"

export default function SegmentsPage() {
  const router = useRouter()
  const { accountId } = useAccountId()
  const queryClient = useQueryClient()

  // Migrated to TanStack Query (Phase A.1): caching + dedup + auto-refetch.
  const { data: segments = [], isLoading, error } = useSegments(accountId)

  useEffect(() => {
    if (error) toast.error(getErrorMessage(error) || "Failed to load segments")
  }, [error])

  const deleteMutation = useMutation({
    mutationFn: (segment: Segment) => deleteSegment(segment.id, accountId as string),
    onSuccess: () => {
      toast.success("Segment deleted")
      queryClient.invalidateQueries({ queryKey: queryKeys.segments(accountId ?? "") })
    },
    onError: (err) => toast.error(getErrorMessage(err) || "Failed to delete segment"),
  })
  const deletingId = deleteMutation.isPending ? deleteMutation.variables?.id : null

  const handleDelete = (segment: Segment) => {
    if (!accountId) return
    deleteMutation.mutate(segment)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Segments"
        description={
          <>
            Saved <Explain term="segment">audience filters</Explain>, evaluated live whenever
            they&apos;re used.
          </>
        }
        actions={
          <Button onClick={() => router.push("/dashboard/segments/new")} disabled={!accountId}>
            <Plus className="mr-2 h-4 w-4" /> New Segment
          </Button>
        }
      />

      <StarterLibrary
        title="Start from a template"
        description="Common audiences, pre-built. Preview against your contacts before saving."
        basePath="/dashboard/segments/new"
        options={SEGMENT_STARTERS}
        disabled={!accountId}
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
                A segment is a saved filter over your contacts — by tags,{" "}
                <Explain term="attribute">attributes</Explain>, activity or campaign behavior. Its
                members are recomputed live, so it never goes stale. Use one as a campaign
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
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {segment.name}
                            {/* Which kind it is changes what the count means:
                                a live query vs a list someone curated. */}
                            {segment.type === "static" && (
                              <Badge variant="outline" className="text-xs font-normal">
                                Fixed list
                              </Badge>
                            )}
                          </div>
                        </TableCell>
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
