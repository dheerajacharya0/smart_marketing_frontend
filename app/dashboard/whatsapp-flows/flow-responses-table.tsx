"use client"

import { useCallback, useEffect, useState } from "react"
import { Inbox, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
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
        <Badge className="bg-success-soft text-success hover:bg-success-soft">
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

  const columns: Column<WhatsappFlowResponse>[] = [
    {
      key: "contact",
      header: "Contact",
      card: "title",
      className: "whitespace-nowrap",
      cell: (response) => <span className="font-mono">+{response.contactWaId}</span>,
    },
    {
      key: "status",
      header: "Status",
      card: "meta",
      cell: (response) => <StatusBadge status={response.status} />,
    },
    {
      key: "answers",
      header: "Answers",
      cardLabel: "Answers",
      className: "max-w-80",
      cell: (response) => <ResponseFields data={response.responseJson} />,
    },
    {
      key: "sent",
      header: "Sent",
      cardLabel: "Sent",
      className: "whitespace-nowrap hide-on-lg",
      cell: (response) => (
        <span className="text-sm text-muted-foreground">{formatDateTime(response.createdAt)}</span>
      ),
    },
    {
      key: "submitted",
      header: "Submitted",
      cardLabel: "Submitted",
      className: "whitespace-nowrap",
      cell: (response) => (
        <span className="text-sm text-muted-foreground">{formatDateTime(response.submittedAt)}</span>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submissions</CardTitle>
        <CardDescription>
          A row appears when the form is sent and fills in when the contact submits it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          rows={responses}
          getRowKey={(response) => response.id}
          isLoading={loading}
          skeletonRows={5}
          // Paged server-side: sorting here would only reorder the page.
          disableSorting
          error={
            error ? (
              <EmptyState
                plain
                icon={TriangleAlert}
                title="Couldn't load submissions"
                description={error}
              />
            ) : undefined
          }
          empty={
            <EmptyState
              icon={Inbox}
              title="Nothing submitted yet"
              description="Send the form to a contact and their answers land here."
            />
          }
          pagination={{
            offset,
            pageSize: PAGE_SIZE,
            total,
            onOffsetChange: setOffset,
            noun: "submission",
          }}
        />
      </CardContent>
    </Card>
  )
}
