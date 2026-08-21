"use client"

import { useState } from "react"
import { Receipt } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DataTable, type Column } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
import { getErrorMessage } from "@/lib/errors"
import { formatMoney, formatSignedMoney } from "@/lib/money"
import { sourceDescription, sourceLabel } from "@/lib/message-source"
import { useBillingEntries } from "@/hooks/use-queries"
import type { BillingEntry } from "@/services/api"

const PAGE_SIZE = 50 // backend caps at 200

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Statement table (Feature 3C): server-paginated, newest first. */
export function StatementTable({ accountId }: { accountId: string | null | undefined }) {
  const [offset, setOffset] = useState(0)
  const { data, isLoading, error } = useBillingEntries(accountId, PAGE_SIZE, offset)

  const entries = data?.entries ?? []
  const total = data?.total ?? 0

  // Eight columns is more than a phone can hold, so the card layout carries the
  // three that answer "what was this": when, how much, and what sent it.
  const columns: Column<BillingEntry>[] = [
    {
      key: "date",
      header: "Date",
      card: "meta",
      className: "whitespace-nowrap",
      cell: (e) => <span className="text-sm text-muted-foreground">{formatDate(e.createdAt)}</span>,
    },
    {
      key: "type",
      header: "Type",
      card: "title",
      cell: (e) => (
        <Badge variant={e.type === "credit" ? "default" : "secondary"}>
          {e.type === "credit" ? "Credit" : "Debit"}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cardLabel: "Amount",
      cell: (e) => (
        <span
          className={`font-mono tabular-nums ${
            e.type === "credit" ? "text-primary" : "text-foreground"
          }`}
        >
          {formatSignedMoney(e.amount, e.type, e.currency)}
        </span>
      ),
    },
    {
      key: "source",
      header: "Sent by",
      cardLabel: "Sent by",
      // Null on credits (a top-up has no feature behind it) and on debits
      // written before attribution existed.
      cell: (e) => (
        <span className="text-sm" title={sourceDescription(e.source)}>
          {sourceLabel(e.source)}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      className: "hide-on-lg",
      card: "hidden",
      cell: (e) => <span className="text-sm">{e.category || "—"}</span>,
    },
    {
      key: "country",
      header: "Country",
      className: "hide-on-lg",
      card: "hidden",
      cell: (e) => <span className="text-sm">{e.country || "—"}</span>,
    },
    {
      key: "reason",
      header: "Reason",
      className: "hide-on-md",
      card: "hidden",
      cell: (e) => (
        <span className="block max-w-64 truncate text-sm text-muted-foreground">
          {e.reason || "—"}
        </span>
      ),
    },
    {
      key: "balance",
      header: "Balance after",
      align: "right",
      cardLabel: "Balance after",
      cell: (e) => (
        <span className="font-mono tabular-nums">{formatMoney(e.balanceAfter, e.currency)}</span>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardDescription>Credits and per-message debits, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          rows={entries}
          getRowKey={(e) => e.id}
          isLoading={isLoading}
          skeletonRows={5}
          // The server returns one page, already ordered newest first. Sorting
          // it here would reorder 50 rows out of thousands and read as sorting
          // the statement.
          disableSorting
          error={
            error ? (
              <EmptyState
                plain
                icon={Receipt}
                title="Couldn't load your transactions"
                description={getErrorMessage(error, "The ledger didn't load. Your balance and history are unaffected — this is a connection problem.")}
              />
            ) : undefined
          }
          empty={
            <EmptyState
              plain
              icon={Receipt}
              title="No transactions yet"
              description="Every top-up and every charged message lands here, with the balance it left behind."
            />
          }
          pagination={{
            offset,
            pageSize: PAGE_SIZE,
            total,
            onOffsetChange: setOffset,
            // "entry" would pluralise to "entrys" in the pager.
            noun: "transaction",
          }}
        />
      </CardContent>
    </Card>
  )
}
