"use client"

import Link from "next/link"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useMetaSpend } from "@/hooks/use-queries"
import { formatMoney } from "@/lib/money"
import { getErrorMessage } from "@/lib/errors"
import type { WabaMetaSpend } from "@/services/api"

/** Meta's pricing categories, in the words a business uses. */
const CATEGORY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  marketing_lite: "Marketing (lite)",
  utility: "Utility",
  authentication: "Authentication",
  authentication_international: "Authentication (international)",
  service: "Service",
  referral_conversion: "Ad referral (free)",
}

const categoryLabel = (c: string) =>
  CATEGORY_LABELS[c] ?? c.replace(/_/g, " ").replace(/^\w/, (ch) => ch.toUpperCase())

/**
 * What Meta charged for this account's messages in the dashboard's range, from
 * Meta's own pricing_analytics. Information only: Meta bills the business's
 * card for these, the wallet never sees them — saying so stops this reading
 * as a second charge next to the wallet.
 */
export function MetaSpendCard({ accountId, from, to }: { accountId: string; from: Date; to: Date }) {
  const { data, isLoading, error, refetch } = useMetaSpend(accountId, from, to)
  const wabas = data?.wabas ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meta charges</CardTitle>
        <CardDescription>
          What Meta billed for messages in this range. Paid to Meta directly — your wallet isn&apos;t
          charged for it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-2/3" />
          </div>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {getErrorMessage(error) || "Couldn't load Meta's charges."}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : wabas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Connect WhatsApp to see what Meta charges you.</p>
        ) : (
          wabas.map((w) => <WabaSpend key={w.wabaId} spend={w} showHeader={wabas.length > 1} />)
        )}
        {!isLoading && !error && wabas.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Meta&apos;s own figures. They&apos;re approximate and can be a few hours behind; your Meta
            invoice is final.{" "}
            <a
              href="https://business.facebook.com/billing_hub/accounts"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 underline underline-offset-4 hover:text-foreground"
            >
              Meta billing <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function WabaSpend({ spend, showHeader }: { spend: WabaMetaSpend; showHeader: boolean }) {
  const currency = spend.currency ?? undefined
  const money = (n: number) => formatMoney(n, currency)
  const charged = spend.total.volume - spend.freeVolume
  const header = showHeader && (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      WhatsApp account {spend.wabaId}
    </p>
  )

  if (spend.status === "error") {
    return (
      <div className="space-y-2">
        {header}
        <div className="flex flex-wrap items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="min-w-0 flex-1">{spend.error ?? "Couldn't load Meta's figures."}</p>
          {spend.errorCode === "reconnect" && (
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href="/dashboard/whatsapp/new">Reconnect</Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (spend.total.volume === 0) {
    return (
      <div className="space-y-2">
        {header}
        <p className="text-sm text-muted-foreground">Meta delivered no messages in this range.</p>
      </div>
    )
  }

  const costKnown = spend.status === "ok"
  // Bars scale to cost; where Meta reports no cost, to volume.
  const measure = (b: { cost: number; volume: number }) => (costKnown ? b.cost : b.volume)
  const max = Math.max(...spend.byCategory.map(measure), 0)

  return (
    <div className="space-y-4">
      {header}
      <div>
        {costKnown ? (
          <p className="font-display text-3xl font-semibold tabular-nums">{money(spend.total.cost)}</p>
        ) : (
          <p className="text-sm">
            Billed through our partner line, so Meta doesn&apos;t report the cost here — your wallet
            covers it.
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {charged.toLocaleString()} charged message{charged === 1 ? "" : "s"}
          {spend.freeVolume > 0 && ` · ${spend.freeVolume.toLocaleString()} free`}
        </p>
      </div>

      <ul className="space-y-2.5" aria-label="By message category">
        {spend.byCategory.map((c) => {
          // A sliver keeps a tiny non-zero value visible; zero stays empty.
          const width = max > 0 && measure(c) > 0 ? Math.max(2, (measure(c) / max) * 100) : 0
          const value = costKnown ? money(c.cost) : `${c.volume.toLocaleString()} msgs`
          return (
            <li key={c.category} className="space-y-1" title={`${categoryLabel(c.category)}: ${value}, ${c.volume.toLocaleString()} messages`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{categoryLabel(c.category)}</span>
                <span className="shrink-0 tabular-nums">
                  {value}
                  {costKnown && (
                    <span className="ml-1.5 text-xs text-muted-foreground">· {c.volume.toLocaleString()} msgs</span>
                  )}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-[hsl(var(--chart-1))]" style={{ width: `${width}%` }} />
              </div>
            </li>
          )
        })}
      </ul>

      {spend.byNumber.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">By number</p>
          <ul className="divide-y rounded-md border">
            {spend.byNumber.map((n) => (
              <li key={n.phoneNumber} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {n.verifiedName ? `${n.verifiedName} · ` : ""}
                  <span className="tabular-nums text-muted-foreground">+{n.phoneNumber}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {costKnown ? money(n.cost) : `${n.volume.toLocaleString()} msgs`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
