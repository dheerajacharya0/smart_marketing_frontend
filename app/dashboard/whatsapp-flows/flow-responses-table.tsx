"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Inbox, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/empty-state"
import { getErrorMessage } from "@/lib/errors"
import {
  listWhatsappFlowResponses,
  type WhatsappFlowResponse,
  type WhatsappFlowResponseStatus,
} from "@/services/api"

const PAGE_SIZE = 25

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatusBadge({ status }: { status: WhatsappFlowResponseStatus }) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
          Submitted
        </Badge>
      )
    case "sent":
      return <Badge variant="outline">Sent, not filled in</Badge>
    case "orphaned":
      // Kept rather than dropped: it's real data from a real person, it just
      // can't be tied to a send we know about.
      return <Badge variant="secondary">Unmatched</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

/** Renders whatever the contact submitted. The shape is the form's, not ours. */
function ResponseFields({ data }: { data: Record<string, unknown> | null | undefined }) {
  if (!data || Object.keys(data).length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="space-y-0.5">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="text-xs">
          <span className="text-muted-foreground">{key}: </span>
          <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * What people filled in.
 *
 * A row exists from the moment a form is sent, not from when it's submitted —
 * so "sent, not filled in" is a real state and the difference between the two
 * is the form's completion rate.
 */
export function FlowResponsesTable({
  accountId,
  metaFlowId,
}: {
  accountId: string
  /** Omit to show every form's submissions. */
  metaFlowId?: string
}) {
  const [responses, setResponses] = useState<WhatsappFlowResponse[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchResponses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listWhatsappFlowResponses({
        accountId,
        ...(metaFlowId ? { metaFlowId } : {}),
        limit: PAGE_SIZE,
        offset,
      })
      setResponses(Array.isArray(res.items) ? res.items : [])
      setTotal(res.total ?? 0)
    } catch (err) {
      setError(getErrorMessage(err) || "Couldn't load submissions")
    } finally {
      setLoading(false)
    }
  }, [accountId, metaFlowId, offset])

  useEffect(() => {
    fetchResponses()
  }, [fetchResponses])

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submissions</CardTitle>
        <CardDescription>
          A row appears when the form is sent and fills in when the contact submits it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Answers</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              ) : responses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      icon={Inbox}
                      title="Nothing submitted yet"
                      description="Send the form to a contact and their answers land here."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                responses.map((response) => (
                  <TableRow key={response.id}>
                    <TableCell className="whitespace-nowrap">+{response.contactWaId}</TableCell>
                    <TableCell>
                      <StatusBadge status={response.status} />
                    </TableCell>
                    <TableCell className="max-w-80">
                      <ResponseFields data={response.responseJson} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(response.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(response.submittedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {page} of {pageCount} · {total} submissions
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
