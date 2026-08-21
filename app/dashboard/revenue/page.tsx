"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, IndianRupee, Loader2, Undo2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { PageHeader } from "@/components/page-header"
import { Explain } from "@/components/explain"
import { StatStrip } from "@/components/stat-strip"
import { describeRevenueSplit } from "@/lib/metric-reads"
import { DateRangePicker, DEFAULT_RANGE, type AnalyticsRange } from "../date-range-picker"
import { toast } from "react-hot-toast"
import { getErrorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import { useAccountId } from "@/hooks/use-account-id"
import { useWallet } from "@/hooks/use-queries"
import {
  getAnalyticsOverview,
  listCampaigns,
  listConversions,
  voidConversion,
  type Campaign,
  type Conversion,
  type RevenueSummary,
} from "@/services/api"

const PAGE_SIZE = 25

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Sales reported against contacts, and what messaging is credited with.
 *
 * Nothing here is measured by us: we don't sell the customer's products and
 * Meta reports nothing about them, so this page is only ever as complete as the
 * store or CRM posting to it. The empty state says that outright rather than
 * looking like a feature that failed to load.
 */
export default function RevenuePage() {
  const { accountId, resolved } = useAccountId()
  const [conversions, setConversions] = useState<Conversion[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [waId, setWaId] = useState("")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_RANGE)
  const [summary, setSummary] = useState<RevenueSummary | null>(null)
  // RevenueSummary carries no currency of its own — an account bills in exactly
  // one, and a sale in any other is refused at write time rather than converted,
  // so the wallet is the only source for it.
  const { data: wallet } = useWallet(accountId)

  const campaignName = (id: string | null) =>
    id ? (campaigns.find((c) => c.id === id)?.name ?? "a campaign") : null

  const fetchConversions = useCallback(async () => {
    if (!accountId) return
    setIsLoading(true)
    try {
      const res = await listConversions({
        accountId,
        ...(search ? { waId: search } : {}),
        limit: PAGE_SIZE,
        offset,
      })
      setConversions(Array.isArray(res.conversions) ? res.conversions : [])
      setTotal(res.total ?? 0)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Couldn't load reported sales")
    } finally {
      setIsLoading(false)
    }
  }, [accountId, search, offset])

  useEffect(() => {
    fetchConversions()
  }, [fetchConversions])

  useEffect(() => {
    if (!accountId) return
    listCampaigns(accountId)
      .then((res) => setCampaigns(Array.isArray(res) ? res : []))
      .catch(() => {})
  }, [accountId])

  // The totals come from the server's own revenue block, ranged. Summing the
  // page of rows below would be a different number — it is one page, and
  // attribution is decided server-side and must not be recomputed here.
  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    getAnalyticsOverview(accountId, range.from.toISOString(), range.to.toISOString())
      .then((res) => {
        if (!cancelled) setSummary(res.revenue ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [accountId, range.from, range.to])

  const handleVoid = async (conversion: Conversion) => {
    if (!accountId) return
    setVoidingId(conversion.id)
    try {
      await voidConversion(conversion.id, accountId, voidReason.trim() || undefined)
      toast.success("Sale voided")
      setVoidReason("")
      fetchConversions()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to void")
    } finally {
      setVoidingId(null)
    }
  }

  const revenueRead = summary ? describeRevenueSplit(summary) : null

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue"
        description="Sales your store or CRM reported against a contact, and which campaign each is credited to."
        actions={<DateRangePicker range={range} onChange={setRange} />}
      />

      {resolved && !accountId ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No connected account yet — link a Facebook/WhatsApp account first.
        </div>
      ) : (
        <>
          {summary && summary.conversions > 0 && (
            <div className="space-y-3">
              <StatStrip
                stats={[
                  {
                    label: "Reported",
                    value: formatMoney(summary.revenue, wallet?.currency),
                    hint: `${summary.conversions.toLocaleString()} sale${
                      summary.conversions === 1 ? "" : "s"
                    } · ${range.label.toLowerCase()}`,
                  },
                  {
                    label: "Credited to a campaign",
                    value: formatMoney(summary.attributedRevenue, wallet?.currency),
                    hint: `${summary.attributedConversions.toLocaleString()} of ${summary.conversions.toLocaleString()}`,
                  },
                ]}
              />
              {revenueRead && <p className="text-sm text-muted-foreground">{revenueRead}</p>}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>How sales get here</CardTitle>
              <CardDescription>
                We can&apos;t see your orders — this page fills up only when your systems tell us
                about them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Post each completed order to <code className="rounded bg-muted px-1">/conversions</code>{" "}
                with the customer&apos;s WhatsApp number and the order total. It accepts an{" "}
                <Explain term="api-key">API key</Explain>, so your store can call it directly — see{" "}
                <Link href="/dashboard/settings" className="underline underline-offset-4">
                  settings
                </Link>{" "}
                to create one.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>
                  Send your own order id as <code className="rounded bg-muted px-1">externalId</code>.
                  Repeating it returns the sale already recorded instead of adding a second one, so a
                  retried webhook can&apos;t double your revenue.
                </li>
                <li>
                  The order total goes in whole currency units (499.50, not paise), in the currency
                  your account bills in — another currency is refused rather than converted.
                </li>
                <li>
                  <Explain term="attribution">Attribution</Explain> is last touch inside a 7-day
                  window: the click if there was one, otherwise the send. Pass a{" "}
                  <code className="rounded bg-muted px-1">campaignId</code> yourself when you already
                  know it, like a coupon code unique to one campaign.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <CardTitle>Reported sales</CardTitle>
                  <CardDescription>{total} recorded, newest first.</CardDescription>
                </div>
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
                        if (e.key === "Enter") {
                          setOffset(0)
                          setSearch(waId.trim())
                        }
                      }}
                      placeholder="919876543210"
                      className="h-9 w-48"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOffset(0)
                        setSearch(waId.trim())
                      }}
                    >
                      Filter
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
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
                                : "Once your store posts an order, it shows up here and on the dashboard."
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      conversions.map((c) => (
                        <TableRow key={c.id} className={c.voidedAt ? "opacity-60" : undefined}>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatDate(c.occurredAt)}
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
                            {c.campaignId ? (
                              <Link
                                href={`/dashboard/campaigns/${c.campaignId}`}
                                className="hover:underline"
                              >
                                {campaignName(c.campaignId)}
                              </Link>
                            ) : (
                              // Not a gap in the data: this sale happened outside
                              // the attribution window, or to someone we never
                              // messaged. It still counts toward the total.
                              <span className="text-muted-foreground">Not attributed</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-40 truncate font-mono text-xs text-muted-foreground">
                            {c.externalId || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {c.voidedAt ? (
                              <span className="text-xs text-muted-foreground">
                                {c.voidReason || "voided"}
                              </span>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" disabled={voidingId === c.id}>
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {total > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {pageCount} · {total} sales
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset === 0 || isLoading}
                      onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pageCount || isLoading}
                      onClick={() => setOffset(offset + PAGE_SIZE)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
