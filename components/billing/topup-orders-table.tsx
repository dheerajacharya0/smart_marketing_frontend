"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
      return <Badge className="bg-green-600 hover:bg-green-600">Paid</Badge>
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

/** Razorpay stores the charge in MINOR units (paise/cents); display needs major. */
function majorUnits(amountMinor: number): number {
  return amountMinor / 100
}

export function TopupOrdersTable({ accountId }: { accountId: string | null | undefined }) {
  const { data, isLoading, error } = useTopupOrders(accountId)
  const orders: TopupOrderRecord[] = data ?? []

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
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {getErrorMessage(error, "Couldn't load payments")}
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No payments yet.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id || o.orderId}>
                    <TableCell className="whitespace-nowrap">{formatDate(o.createdAt)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(majorUnits(o.amount), o.currency)}
                    </TableCell>
                    <TableCell>{statusBadge(o.status)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {o.orderId || o.id}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
