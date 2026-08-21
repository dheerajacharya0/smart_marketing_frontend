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

  // One definition drives the desktop table and the phone card list.
  const columns: Column<Segment>[] = [
    {
      key: "name",
      header: "Name",
      card: "title",
      sortValue: (s) => s.name,
      cell: (segment) => (
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
      ),
    },
    {
      key: "description",
      header: "Description",
      className: "max-w-64 truncate hide-on-lg",
      cell: (segment) => (
        <span className="text-sm text-muted-foreground">{segment.description || "—"}</span>
      ),
    },
    {
      key: "members",
      header: "Members",
      cardLabel: "Members",
      sortValue: (s) => s.memberCount ?? null,
      cell: (segment) => (
        <span className="inline-flex items-center gap-1 text-sm">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {segment.memberCount ?? "—"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      className: "whitespace-nowrap hide-on-md",
      sortValue: (s) => s.createdAt,
      cell: (segment) => (
        <span className="text-sm text-muted-foreground">{formatDate(segment.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      card: "actions",
      cell: (segment) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
                <AlertDialogTitle>Delete &quot;{segment.name}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>
                  Contacts are not affected — only the saved filter is removed. This can&apos;t be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(segment)}>Delete</AlertDialogAction>
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
          <CardTitle>All segments</CardTitle>
          <CardDescription>Member counts are computed live per request.</CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && accountId && segments.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="No segments yet"
              description={
                <>
                  A segment is a saved filter over your contacts — by tags,{" "}
                  <Explain term="attribute">attributes</Explain>, activity or campaign behavior.
                </>
              }
              action={
                <Button onClick={() => router.push("/dashboard/segments/new")}>
                  <Plus className="mr-2 h-4 w-4" /> New Segment
                </Button>
              }
              hint="Members are recomputed live, so a segment never goes stale. Use one as a campaign audience."
            />
          ) : (
            <DataTable
              columns={columns}
              rows={segments}
              getRowKey={(segment) => segment.id}
              isLoading={isLoading}
              skeletonRows={3}
              onRowClick={(segment) => router.push(`/dashboard/segments/${segment.id}`)}
              empty={
                <EmptyState
                  plain
                  icon={Filter}
                  title="No connected account yet"
                  description="Link a Facebook or WhatsApp Business account before building segments."
                />
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
