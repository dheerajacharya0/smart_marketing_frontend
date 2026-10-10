"use client"

import { useState } from "react"
import { FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/empty-state"
import { DataTable, type Column } from "@/components/data-table"
import { toast } from "react-hot-toast"
import { getErrorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import {
  getSubscriptionInvoice,
  type SubscriptionInvoiceDetail,
  type SubscriptionInvoiceSummary,
} from "@/services/api"
import { useSubscriptionInvoices } from "@/hooks/use-queries"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * Tax invoices for settled subscription charges — one per billing cycle,
 * the recurring equivalent of InvoicesTable. Same reasoning: rendered from
 * the stored breakdown, never recomputed, because rates change and an
 * issued document has to keep saying what it said.
 */
export function SubscriptionInvoicesTable({
  accountId,
}: {
  accountId: string | null | undefined
}) {
  const { data, isLoading, error, refetch } = useSubscriptionInvoices(accountId)
  const [open, setOpen] = useState<SubscriptionInvoiceDetail | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const invoices: SubscriptionInvoiceSummary[] = Array.isArray(data) ? data : []
  const loadError = error ? getErrorMessage(error, "Couldn't load your invoices") : null

  const openInvoice = async (summary: SubscriptionInvoiceSummary) => {
    if (!accountId) return
    setLoadingId(summary.id)
    try {
      setOpen(await getSubscriptionInvoice(summary.id, accountId))
    } catch (err) {
      setOpen(null)
      toast.error(getErrorMessage(err) || "Couldn't open that invoice")
    } finally {
      setLoadingId(null)
    }
  }

  const invoiceColumns: Column<SubscriptionInvoiceSummary>[] = [
    {
      key: "number",
      header: "Invoice",
      card: "title",
      sortValue: (invoice) => invoice.invoiceNumber,
      cell: (invoice) => <span className="font-mono text-xs">{invoice.invoiceNumber}</span>,
    },
    {
      key: "date",
      header: "Date",
      card: "meta",
      sortValue: (invoice) => invoice.issuedAt,
      cell: (invoice) => (
        <span className="text-sm text-muted-foreground">{formatDate(invoice.issuedAt)}</span>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      card: "meta",
      className: "hide-on-sm",
      cell: (invoice) => (
        <span className="text-sm text-muted-foreground">
          {invoice.tier[0].toUpperCase() + invoice.tier.slice(1)} ({invoice.billingPeriod})
        </span>
      ),
    },
    {
      key: "tax",
      header: "Tax",
      align: "right",
      cardLabel: "Tax",
      className: "hide-on-sm",
      sortValue: (invoice) => invoice.tax,
      cell: (invoice) => (
        <span className="font-mono tabular-nums">{formatMoney(invoice.tax, invoice.currency)}</span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cardLabel: "Total",
      sortValue: (invoice) => invoice.total,
      cell: (invoice) => (
        <span className="font-mono font-medium tabular-nums">
          {formatMoney(invoice.total, invoice.currency)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      card: "actions",
      cell: (invoice) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={loadingId === invoice.id}
          onClick={() => openInvoice(invoice)}
        >
          {loadingId === invoice.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "View"}
        </Button>
      ),
    },
  ]

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Subscription invoices</CardTitle>
          <CardDescription>One per billed cycle. Nothing here until the first charge settles.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={invoiceColumns}
            rows={invoices}
            getRowKey={(invoice) => invoice.id}
            isLoading={isLoading}
            skeletonRows={3}
            defaultSortKey="date"
            defaultSortDirection="desc"
            error={
              loadError ? (
                <EmptyState
                  plain
                  icon={FileText}
                  title="Couldn't load your invoices"
                  description={loadError}
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
                icon={FileText}
                title="No invoices yet"
                description="Your first settled charge produces one."
              />
            }
          />
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice {open?.invoiceNumber}</DialogTitle>
            <DialogDescription>Issued {formatDate(open?.issuedAt ?? null)}</DialogDescription>
          </DialogHeader>

          {open && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">From</p>
                  <p>{open.supplier.name || "—"}</p>
                  {open.supplier.address && (
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {open.supplier.address}
                    </p>
                  )}
                  {open.supplier.gstin && (
                    <p className="font-mono text-xs text-muted-foreground">
                      GSTIN {open.supplier.gstin}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">To</p>
                  <p>{open.customer.name || "—"}</p>
                  {open.customer.address && (
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {open.customer.address}
                    </p>
                  )}
                  {open.customer.gstin ? (
                    <p className="font-mono text-xs text-muted-foreground">
                      GSTIN {open.customer.gstin}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No GSTIN was on file when this was issued.
                    </p>
                  )}
                </div>
              </div>

              {open.placeOfSupply && (
                <p className="text-xs text-muted-foreground">
                  Place of supply: {open.placeOfSupply}
                </p>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {open.lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell>{line.description}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatMoney(line.amount, open.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {open.taxLines.map((line, i) => (
                      <TableRow key={`tax-${i}`}>
                        <TableCell className="text-muted-foreground">{line.label}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {formatMoney(line.amount, open.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-medium">Total</TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-medium">
                        {formatMoney(open.total, open.currency)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="text-xs text-muted-foreground">
                Paid via {open.payment.provider}
                {open.payment.paymentId ? ` · ${open.payment.paymentId}` : ""}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
