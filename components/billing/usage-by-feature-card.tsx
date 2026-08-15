"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getErrorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import { sharePercent, sourceDescription, sourceLabel } from "@/lib/message-source"
import { useBillingUsage } from "@/hooks/use-queries"

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const

type RangeValue = (typeof RANGES)[number]["value"]

function rangeStart(value: RangeValue): string | undefined {
  if (value === "all") return undefined
  const from = new Date()
  from.setDate(from.getDate() - Number(value))
  return from.toISOString()
}

/**
 * Where the money went, by feature.
 *
 * Debits only — a top-up has no feature behind it — so the total here is money
 * spent on messages and will never match the wallet balance or the top-up total.
 * The card says so rather than letting someone reconcile two numbers that were
 * never meant to agree.
 */
export function UsageByFeatureCard({ accountId }: { accountId: string | null | undefined }) {
  const [range, setRange] = useState<RangeValue>("30")
  const from = useMemo(() => rangeStart(range), [range])
  const { data, isLoading, error } = useBillingUsage(accountId, from)

  const rows = data?.bySource ?? []
  const total = data?.totalCharged ?? 0
  const currency = data?.currency

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Where your money went</CardTitle>
            <CardDescription>
              Message spend by the feature that sent it. Top-ups aren&apos;t included.
            </CardDescription>
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as RangeValue)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive">
            {getErrorMessage(error, "Couldn't load your usage breakdown")}
          </p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No message charges in this period.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                {data?.totalMessages.toLocaleString()} messages
              </span>
              <span className="font-mono text-lg tabular-nums">
                {formatMoney(total, currency)}
              </span>
            </div>

            <div className="space-y-3">
              {rows.map((row) => {
                const share = sharePercent(row.charged, total)
                return (
                  <div key={row.source} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium" title={sourceDescription(row.source)}>
                        {sourceLabel(row.source)}
                      </span>
                      <span className="font-mono text-sm tabular-nums">
                        {formatMoney(row.charged, currency)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {row.messages.toLocaleString()} message{row.messages === 1 ? "" : "s"}
                      </span>
                      <span>{share.toFixed(share < 1 ? 1 : 0)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {rows.some((r) => r.source === "unattributed") && (
              <p className="text-xs text-muted-foreground">
                “Before tracking” is spend from before we started recording which feature caused
                each charge. It can&apos;t be filled in afterwards, so it only shrinks as older
                charges fall out of the period you&apos;re looking at.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
