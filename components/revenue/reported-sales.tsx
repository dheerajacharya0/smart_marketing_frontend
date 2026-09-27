"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, IndianRupee, Loader2, Undo2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { EmptyState } from "@/components/empty-state"
import { getErrorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import { formatDateTime } from "@/lib/format-date"
import { senderHref, senderKind } from "@/lib/ledger"
import {
  queryKeys,
  useAutomationRules,
  useCampaigns,
  useDrips,
  useFlows,
} from "@/hooks/use-queries"
import { listConversions, voidConversion, type Conversion, type CreditedSource } from "@/services/api"

const PAGE_SIZE = 25

/** The credited sender of a sale, reading `campaignId` for rows older than the ledger. */
function creditOf(c: Conversion): { type: CreditedSource; id: string } | null {
  if (c.sourceType && c.sourceRefId) return { type: c.sourceType, id: c.sourceRefId }
  if (c.campaignId) return { type: "campaign", id: c.campaignId }
  return null
}

/**
 * Every sale on record, newest first, with the sender it is credited to and a
 * void action for refunds. Deliberately not ranged by the page's date picker:
 * this is the audit trail, and a sale should be findable by number whatever
 * range the totals above are showing.
 */
export function ReportedSales({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [waId, setWaId] = useState("")
  const [search, setSearch] = useState("")
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState("")

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["conversions", accountId, search, offset],
    queryFn: () =>
      listConversions({ accountId, ...(search ? { waId: search } : {}), limit: PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
  })
  const conversions = data?.conversions ?? []
  const total = data?.total ?? 0

  const { data: campaigns } = useCampaigns(accountId)
  const { data: drips } = useDrips(accountId)
  const { data: flows } = useFlows(accountId)
  const { data: rules } = useAutomationRules(accountId)
  const names = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of campaigns ?? []) m.set(`campaign:${c.id}`, c.name)
    for (const d of drips ?? []) m.set(`drip:${d.id}`, d.name)
    for (const f of flows ?? []) m.set(`flow:${f.id}`, f.name)
    for (const r of rules ?? []) m.set(`automation:${r.id}`, r.name)
    return m
  }, [campaigns, drips, flows, rules])

  const handleVoid = async (conversion: Conversion) => {
    setVoidingId(conversion.id)
    try {
      await voidConversion(conversion.id, accountId, voidReason.trim() || undefined)
      toast.success("Sale voided")
      setVoidReason("")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversions", accountId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ledger(accountId) }),
      ])
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to void")
    } finally {
      setVoidingId(null)
    }
  }

  const applySearch = () => {
    setOffset(0)
    setSearch(waId.trim())
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} recorded, newest first.</p>
        <div className="grid gap-1.5">
          <Label htmlFor="revenue-search" className="text-xs">
            Filter by number
          </Label>
          <div className="flex gap-2">
            <Input
              id="revenue-search"
              value={waId}
              onChange={(e) => setWaId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch()
              }}
              placeholder="919876543210"
              className="h-9 w-48"
            />
            <Button variant="outline" size="sm" onClick={applySearch}>
              Filter
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Credited to</TableHead>
              <TableHead>Order id</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : conversions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={IndianRupee}
                    title={search ? "No sales for that number" : "No sales reported yet"}
                    description={
                      search
                        ? "Nothing has been reported against this contact."
                        : "Once your store posts an order, it shows up here and in the totals above."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              conversions.map((c) => {
                const credit = creditOf(c)
                return (
                  <TableRow key={c.id} className={c.voidedAt ? "opacity-60" : undefined}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(c.occurredAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">+{c.waId}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatMoney(c.value, c.currency)}
                      {c.voidedAt && (
                        <Badge variant="secondary" className="ml-2">
                          Voided
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {credit ? (
                        <Link href={senderHref(credit.type, credit.id)} className="hover:underline">
                          <span className="text-muted-foreground">{senderKind(credit.type)}: </span>
                          {names.get(`${credit.type}:${credit.id}`) ?? "deleted"}
                        </Link>
                      ) : (
                        // Not a gap in the data: this sale happened outside the
                        // attribution window, or to someone we never messaged.
                        // It still counts toward the total.
                        <span className="text-muted-foreground">Not attributed</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-40 truncate font-mono text-xs text-muted-foreground">
                      {c.externalId || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.voidedAt ? (
                        <span className="text-xs text-muted-foreground">{c.voidReason || "voided"}</span>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={voidingId === c.id}
                              aria-label="Void sale"
                            >
                              {voidingId === c.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Undo2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Void {formatMoney(c.value, c.currency)} from +{c.waId}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Use this for a refund or a cancelled order. The row is kept and
                                marked rather than deleted, so your totals here still reconcile
                                against your own books.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="grid gap-2">
                              <Label htmlFor="void-reason">Reason (optional)</Label>
                              <Input
                                id="void-reason"
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                placeholder="Refunded — item out of stock"
                              />
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setVoidReason("")}>
                                Keep it
                              </AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleVoid(c)}>
                                Void sale
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount} · {total.toLocaleString()} sales
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0 || isFetching}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount || isFetching}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
