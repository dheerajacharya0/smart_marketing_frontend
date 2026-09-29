"use client"

import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMoney } from "@/lib/money"
import { formatDateTime } from "@/lib/format-date"
import { formatReturn, senderHref, senderKind, sourceLabel } from "@/lib/ledger"
import type {
  LedgerCustomerRow,
  LedgerSenderRow,
  LedgerSourceRow,
} from "@/services/api"

function Loading({ cols }: { cols: number }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="h-24 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
      </TableCell>
    </TableRow>
  )
}

function Empty({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="h-24 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  )
}

const num = "text-right font-mono tabular-nums"

/**
 * Spend and revenue side by side for one row. The return column is the one an
 * owner scans, so it is last and bold; "—" means nothing was spent, not that
 * nothing was earned.
 */
function Figures({
  row,
  currency,
}: {
  row: { spend: { units: number }; messages: number; revenue: { units: number }; orders: number; returnOnSpend: number | null }
  currency: string
}) {
  return (
    <>
      <TableCell className={num}>{formatMoney(row.spend.units, currency)}</TableCell>
      <TableCell className={num}>{row.messages.toLocaleString()}</TableCell>
      <TableCell className={num}>{row.orders.toLocaleString()}</TableCell>
      <TableCell className={num}>{formatMoney(row.revenue.units, currency)}</TableCell>
      <TableCell className={`${num} font-semibold`}>{formatReturn(row.returnOnSpend)}</TableCell>
    </>
  )
}

function FigureHeads() {
  return (
    <>
      <TableHead className="text-right">Spent</TableHead>
      <TableHead className="text-right">Messages</TableHead>
      <TableHead className="text-right">Orders</TableHead>
      <TableHead className="text-right">Revenue</TableHead>
      <TableHead className="text-right">Return</TableHead>
    </>
  )
}

/** Every source, including the ones that can never earn credit — their spend is real. */
export function SourcesTable({
  rows,
  isLoading,
  currency,
}: {
  rows: LedgerSourceRow[] | undefined
  isLoading: boolean
  currency: string
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <FigureHeads />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <Loading cols={6} />
          ) : !rows?.length ? (
            <Empty cols={6}>No spend or sales in this range.</Empty>
          ) : (
            rows.map((r) => (
              <TableRow key={r.source}>
                <TableCell className="font-medium">{sourceLabel(r.source)}</TableCell>
                <Figures row={r} currency={currency} />
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function SendersTable({
  rows,
  isLoading,
  currency,
}: {
  rows: LedgerSenderRow[] | undefined
  isLoading: boolean
  currency: string
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sender</TableHead>
            <FigureHeads />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <Loading cols={6} />
          ) : !rows?.length ? (
            <Empty cols={6}>
              No campaign, drip, flow, automation or inbox reply sent or earned anything in this range.
            </Empty>
          ) : (
            rows.map((r) => (
              <TableRow key={`${r.sourceType}:${r.sourceRefId}`}>
                <TableCell>
                  <span className="text-xs text-muted-foreground">{senderKind(r.sourceType)}</span>
                  <div className="font-medium">
                    {r.sourceType === "manual" ? (
                      <Link href={senderHref(r.sourceType, null)} className="hover:underline">
                        Inbox replies
                      </Link>
                    ) : r.name ? (
                      <Link href={senderHref(r.sourceType, r.sourceRefId)} className="hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      // Deleted since. Its money still happened, so the row stays.
                      <span className="text-muted-foreground">Deleted</span>
                    )}
                  </div>
                </TableCell>
                <Figures row={r} currency={currency} />
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function CustomersTable({
  rows,
  isLoading,
  currency,
}: {
  rows: LedgerCustomerRow[] | undefined
  isLoading: boolean
  currency: string
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead>Last order</TableHead>
            <TableHead className="text-right">Spent on them</TableHead>
            <TableHead className="text-right">Return</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <Loading cols={6} />
          ) : !rows?.length ? (
            <Empty cols={6}>No customers bought in this range.</Empty>
          ) : (
            rows.map((r) => (
              <TableRow key={r.waId}>
                <TableCell>
                  <div className="font-medium">{r.name || `+${r.waId}`}</div>
                  {r.name && <div className="text-xs text-muted-foreground">+{r.waId}</div>}
                </TableCell>
                <TableCell className={num}>
                  {r.orders.toLocaleString()}
                  {r.attributedOrders < r.orders && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({r.attributedOrders} credited)
                    </span>
                  )}
                </TableCell>
                <TableCell className={num}>{formatMoney(r.revenue.units, currency)}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDateTime(r.lastOrderAt)}
                </TableCell>
                <TableCell className={num}>{formatMoney(r.spend.units, currency)}</TableCell>
                <TableCell className={`${num} font-semibold`}>{formatReturn(r.returnOnSpend)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
