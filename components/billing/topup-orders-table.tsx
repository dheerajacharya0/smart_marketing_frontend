"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Receipt, TriangleAlert } from "lucide-react"
import { getErrorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import { useTopupOrders } from "@/hooks/use-queries"
import type { TopupOrderRecord } from "@/services/api"

/**
 * Payment history — every Razorpay top-up order and where it got to.
 *
 * `status` is the honest one: an order sits at `created` until the Razorpay
 * webhook credits the wallet and flips it to `paid`. A user who paid but doesn't
 * see the balance yet can see the order here rather than paying twice.
 */

function statusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-success hover:bg-success">Paid</Badge>
    case "failed":
      return <Badge variant="destructive">Failed</Badge>
    case "created":
      return <Badge variant="secondary">Awaiting payment</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function TopupOrdersTable({ accountId }: { accountId: string | null | undefined }) {
  const { data, isLoading, error } = useTopupOrders(accountId)
  const orders: TopupOrderRecord[] = data ?? []

  const columns: Column<TopupOrderRecord>[] = [
    {
      key: "date",
      header: "Date",
      card: "meta",
      className: "whitespace-nowrap",
      sortValue: (o) => o.createdAt,
      cell: (order) => formatDate(order.createdAt),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      card: "title",
      sortValue: (o) => o.amount,
      cell: (order) => (
        // Whole units already — the backend converts from micros.
        <span className="font-mono">{formatMoney(order.amount, order.currency)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cardLabel: "Status",
      sortValue: (o) => o.status,
      cell: (order) => statusBadge(order.status),
    },
    {
      key: "order",
      header: "Order",
      cardLabel: "Order",
      cell: (order) => (
        <span className="font-mono text-xs text-muted-foreground">{order.orderId || order.id}</span>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        <CardDescription>
          Top-up orders. Credit lands when your bank confirms the payment, which can trail the
          checkout by a few seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          rows={orders}
          getRowKey={(order) => order.id}
          isLoading={isLoading}
          skeletonRows={3}
          defaultSortKey="date"
          defaultSortDirection="desc"
          error={
            error ? (
              <EmptyState
                plain
                icon={TriangleAlert}
                title="Couldn't load payments"
                description={getErrorMessage(error, "Try again in a moment.")}
              />
            ) : undefined
          }
          empty={
            <EmptyState
              plain
              icon={Receipt}
              title="No payments yet"
              description="Top-ups you make show up here with their order reference."
            />
          }
        />
      </CardContent>
    </Card>
  )
}
