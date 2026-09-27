"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RecordSaleDialog } from "@/components/revenue/record-sale-dialog"
import { LedgerChart } from "@/components/revenue/ledger-chart"
import { CustomersTable, SendersTable, SourcesTable } from "@/components/revenue/ledger-breakdown"
import { ReportedSales } from "@/components/revenue/reported-sales"
import { PageHeader } from "@/components/page-header"
import { Explain } from "@/components/explain"
import { StatStrip } from "@/components/stat-strip"
import { describeRevenueSplit } from "@/lib/metric-reads"
import { describeChange, explainNoAttribution, formatReturn } from "@/lib/ledger"
import { getErrorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import { DateRangePicker, DEFAULT_RANGE, type AnalyticsRange } from "../date-range-picker"
import { useAccountId } from "@/hooks/use-account-id"
import {
  queryKeys,
  useLedgerCustomers,
  useLedgerSenders,
  useLedgerSettings,
  useLedgerSources,
  useLedgerSummary,
  useLedgerTimeseries,
} from "@/hooks/use-queries"
import { updateLedgerSettings } from "@/services/api"

type Tab = "sources" | "senders" | "customers" | "sales"

/** The viewer's zone, so a day on the chart is the day they lived through. */
function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/**
 * The revenue ledger: what WhatsApp cost this account and what it brought back.
 *
 * Spend is the wallet's debits and revenue is the reported sales, both summed
 * server-side, so every figure here reconciles to the billing page or to the
 * sales list — nothing is recomputed in the browser. Sales only arrive from the
 * customer's store, API key or "Record a sale"; we can't see orders ourselves,
 * and the empty states say that rather than looking broken.
 */
export default function RevenuePage() {
  const { accountId, resolved } = useAccountId()
  const queryClient = useQueryClient()
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_RANGE)
  const [tab, setTab] = useState<Tab>("sources")
  const [showRecordSale, setShowRecordSale] = useState(false)
  const tz = useMemo(viewerTimeZone, [])

  const from = range.from.toISOString()
  const to = range.to.toISOString()
  const summary = useLedgerSummary(accountId, from, to)
  const series = useLedgerTimeseries(accountId, from, to, tz)
  const sources = useLedgerSources(accountId, from, to)
  // The heavier breakdowns load when their tab is first opened.
  const senders = useLedgerSenders(accountId, from, to, tab === "senders")
  const customers = useLedgerCustomers(accountId, from, to, tab === "customers")
  const settings = useLedgerSettings(accountId)

  const windowMutation = useMutation({
    mutationFn: (days: number | null) => updateLedgerSettings(accountId as string, days),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.ledgerSettings(accountId as string), next)
      void queryClient.invalidateQueries({ queryKey: queryKeys.ledger(accountId as string) })
      toast.success(`Sales from now on are credited within ${next.attributionWindowDays} days`)
    },
    onError: (err) => toast.error(getErrorMessage(err) || "Couldn't change the window"),
  })

  const data = summary.data
  const currency = data?.currency ?? "INR"
  const cur = data?.current
  const prev = data?.previous
  const windowDays = settings.data?.attributionWindowDays ?? data?.attributionWindowDays ?? 7

  const noCredit = cur
    ? explainNoAttribution({
        orders: cur.orders,
        attributedOrders: cur.attributedOrders,
        messages: cur.messages,
        windowDays,
      })
    : null
  const splitRead =
    cur && cur.attributedOrders > 0
      ? describeRevenueSplit(
          {
            conversions: cur.orders,
            attributedConversions: cur.attributedOrders,
            revenue: cur.revenue.units,
            attributedRevenue: cur.attributedRevenue.units,
          },
          windowDays
        )
      : null

  const refreshAfterSale = () => {
    if (!accountId) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.ledger(accountId) })
    void queryClient.invalidateQueries({ queryKey: ["conversions", accountId] })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue"
        description="What WhatsApp cost you, and what it brought back."
        actions={
          <>
            <DateRangePicker range={range} onChange={setRange} />
            <Button onClick={() => setShowRecordSale(true)} disabled={!accountId}>
              <Plus className="mr-2 h-4 w-4" /> Record a sale
            </Button>
          </>
        }
      />

      {resolved && !accountId ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No connected account yet — link a Facebook/WhatsApp account first.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <StatStrip
              stats={[
                {
                  label: "Return on spend",
                  value: summary.isLoading ? "…" : formatReturn(cur?.returnOnSpend),
                  hint:
                    cur?.returnOnSpend != null
                      ? `${formatMoney(cur.returnOnSpend, currency)} back per ${formatMoney(1, currency)} spent`
                      : cur && cur.spend.units === 0
                        ? "nothing spent in this range"
                        : undefined,
                  tone: cur?.returnOnSpend != null && cur.returnOnSpend >= 1 ? "success" : "default",
                },
                {
                  label: "Revenue from WhatsApp",
                  value: cur ? formatMoney(cur.attributedRevenue.units, currency) : "…",
                  hint:
                    cur && prev
                      ? `${cur.attributedOrders.toLocaleString()} order${
                          cur.attributedOrders === 1 ? "" : "s"
                        } · ${describeChange(cur.attributedRevenue.units, prev.attributedRevenue.units)}`
                      : undefined,
                },
                {
                  label: "Spent on WhatsApp",
                  value: cur ? formatMoney(cur.spend.units, currency) : "…",
                  hint:
                    cur && prev
                      ? `${cur.messages.toLocaleString()} messages · ${describeChange(
                          cur.spend.units,
                          prev.spend.units
                        )}`
                      : undefined,
                },
                {
                  label: "Other revenue",
                  value: cur ? formatMoney(cur.unattributedRevenue.units, currency) : "…",
                  hint: cur
                    ? `${(cur.orders - cur.attributedOrders).toLocaleString()} sales no message can take credit for`
                    : undefined,
                },
              ]}
            />
            {(splitRead || noCredit) && (
              <p className="text-sm text-muted-foreground">{splitRead ?? noCredit}</p>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Day by day</CardTitle>
              <CardDescription>
                Spend lands on the day a message is charged; revenue lands on the day of the sale.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {series.data ? (
                <LedgerChart data={series.data} currency={currency} />
              ) : (
                <div className="h-72 animate-pulse rounded-md bg-muted/40" />
              )}
            </CardContent>
          </Card>

          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="sources">By source</TabsTrigger>
              <TabsTrigger value="senders">By sender</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="sales">All sales</TabsTrigger>
            </TabsList>
            <TabsContent value="sources" className="mt-4">
              <SourcesTable rows={sources.data?.rows} isLoading={sources.isLoading} currency={currency} />
            </TabsContent>
            <TabsContent value="senders" className="mt-4">
              <SendersTable rows={senders.data?.rows} isLoading={senders.isLoading} currency={currency} />
            </TabsContent>
            <TabsContent value="customers" className="mt-4">
              <CustomersTable rows={customers.data?.rows} isLoading={customers.isLoading} currency={currency} />
            </TabsContent>
            <TabsContent value="sales" className="mt-4">
              {accountId && <ReportedSales accountId={accountId} />}
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>How sales get here</CardTitle>
              <CardDescription>
                We can&apos;t see your orders — this page fills up only when your systems tell us about
                them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                On Shopify?{" "}
                <Link href="/dashboard/integrations" className="underline underline-offset-4">
                  Connect your store
                </Link>{" "}
                and every order arrives here on its own, refunds and cancellations included.
              </p>
              <p>
                Otherwise, post each completed order to <code className="rounded bg-muted px-1">/conversions</code>{" "}
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
                  The order total goes in whole currency units (499.50, not paise), in the currency your
                  account bills in — another currency is refused rather than converted.
                </li>
                <li>
                  <Explain term="attribution">Attribution</Explain> is last touch: the last campaign,
                  drip, flow or automation to message that number before the sale — the click if there
                  was one, otherwise the send. Inbox replies are never credited. Pass a{" "}
                  <code className="rounded bg-muted px-1">campaignId</code> yourself when you already
                  know it, like a coupon code unique to one campaign.
                </li>
              </ul>

              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <label htmlFor="attribution-window" className="font-medium">
                  Credit a sale to a message sent up to
                </label>
                <Select
                  value={String(windowDays)}
                  onValueChange={(v) => windowMutation.mutate(Number(v))}
                  disabled={!settings.data || windowMutation.isPending}
                >
                  <SelectTrigger id="attribution-window" className="h-9 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(settings.data?.windowChoices ?? [1, 7, 14, 30]).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} day{d === 1 ? "" : "s"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">
                  before it. Applies to sales recorded from now on; past sales keep the window they were
                  credited under.
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {accountId && (
        <RecordSaleDialog
          open={showRecordSale}
          onOpenChange={setShowRecordSale}
          accountId={accountId}
          currency={currency}
          onRecorded={refreshAfterSale}
        />
      )}
    </div>
  )
}
