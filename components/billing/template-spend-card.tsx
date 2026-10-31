"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronDown, ExternalLink, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useTemplateSpend } from "@/hooks/use-queries"
import { useActiveNumber } from "@/hooks/use-active-number"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { getErrorMessage } from "@/lib/errors"
import type { TemplateSpend, WabaTemplateSpend } from "@/services/api"

const categoryLabel = (c: string | null) =>
  c ? c.charAt(0) + c.slice(1).toLowerCase() : "Uncategorized"

const ROWS_SHOWN = 5

/**
 * Cost per template, from Meta's own template_analytics. Separate endpoint
 * from the account-wide Meta charges card, so a WABA where the owner hasn't
 * confirmed template analytics in WhatsApp Manager shows that explicitly
 * rather than failing the whole card — we never flip that confirmation
 * ourselves, since Meta documents it as a one-way switch that also turns on
 * link tracking and chat-data collection for the account.
 */
export function TemplateSpendCard({ accountId, from, to }: { accountId: string; from: Date; to: Date }) {
  const { data, isLoading, error, refetch } = useTemplateSpend(accountId, from, to)
  const wabas = data?.wabas ?? []
  const { numbers } = useActiveNumber()
  const accountLabel = (wabaId: string) => {
    const own = numbers.filter((n) => n.wabaId === wabaId)
    if (own.length === 0) return `WhatsApp account ending ${wabaId.slice(-4)}`
    return own
      .map((n) => [n.displayPhoneNumber || `Number ending ${n.phoneNumberId.slice(-4)}`, n.verifiedName].filter(Boolean).join(" · "))
      .join(", ")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template costs</CardTitle>
        <CardDescription>
          What each template cost through Meta in this range. Paid to Meta directly. Your wallet
          isn&apos;t charged for it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {getErrorMessage(error) || "Couldn't load template costs."}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : wabas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates sent yet.</p>
        ) : (
          wabas.map((w) => (
            <WabaTemplates key={w.wabaId} spend={w} label={wabas.length > 1 ? accountLabel(w.wabaId) : null} />
          ))
        )}
        {!isLoading && !error && wabas.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Meta&apos;s own figures. They&apos;re approximate and can be a few hours behind.{" "}
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

function WabaTemplates({ spend, label }: { spend: WabaTemplateSpend; label: string | null }) {
  const currency = spend.currency ?? undefined
  const money = (n: number) => formatMoney(n, currency)
  // Declared before the early returns below (not_enabled/error/empty), which
  // render without a template list at all — the hook still has to run every
  // time this component renders, regardless of which branch it takes.
  const [expanded, setExpanded] = useState(false)
  const header = label && (
    <p className="text-xs font-medium text-muted-foreground" title={`WhatsApp account ${spend.wabaId}`}>
      {label}
    </p>
  )

  if (spend.status === "not_enabled") {
    return (
      <div className="space-y-2">
        {header}
        <div className="flex flex-wrap items-start gap-2 rounded-md border border-dashed bg-muted/30 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 text-muted-foreground">
            Template analytics isn&apos;t turned on for this WhatsApp account yet. Turn it on from
            WhatsApp Manager to see cost per template here — it&apos;s a one-time, one-way switch on
            Meta&apos;s side, so we don&apos;t flip it for you.
          </p>
          <Button asChild variant="outline" size="sm" className="h-8 shrink-0">
            <a href="https://business.facebook.com/wa/manage/home/" target="_blank" rel="noopener noreferrer">
              Open WhatsApp Manager <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>
    )
  }

  if (spend.status === "error") {
    return (
      <div className="space-y-2">
        {header}
        <div className="flex flex-wrap items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="min-w-0 flex-1">{spend.error ?? "Couldn't load template costs."}</p>
          {spend.errorCode === "reconnect" && (
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href="/dashboard/whatsapp/new">Reconnect</Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (spend.templates.length === 0) {
    return (
      <div className="space-y-2">
        {header}
        <p className="text-sm text-muted-foreground">No templates sent in this range.</p>
      </div>
    )
  }

  const costKnown = spend.status === "ok"
  const shown = expanded ? spend.templates : spend.templates.slice(0, ROWS_SHOWN)
  const rest = spend.templates.length - ROWS_SHOWN

  return (
    <div className="space-y-3">
      {header}
      {!costKnown && (
        <p className="text-xs text-muted-foreground">
          Billed through our partner line, so Meta doesn&apos;t report cost here. Your wallet covers it.
        </p>
      )}
      <ul className="divide-y rounded-md border" aria-label="By template">
        {shown.map((t) => (
          <TemplateRow key={t.templateId} t={t} costKnown={costKnown} money={money} />
        ))}
      </ul>
      {rest > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-between rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50"
        >
          <span>{expanded ? "Show fewer" : `${rest} more template${rest === 1 ? "" : "s"}`}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </div>
  )
}

function TemplateRow({ t, costKnown, money }: { t: TemplateSpend; costKnown: boolean; money: (n: number) => string }) {
  const clicks = t.urlClicks + t.quickReplyClicks
  return (
    <li className="space-y-1 px-3 py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate" title={t.templateId}>
          {t.name ?? `Template ${t.templateId.slice(-6)}`}
        </span>
        <span className="shrink-0 tabular-nums">
          {costKnown ? money(t.amountSpent) : `${t.sent.toLocaleString()} sent`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {categoryLabel(t.category)} · {t.delivered.toLocaleString()} delivered
        {costKnown && t.costPerDelivered !== null && ` · ${money(t.costPerDelivered)}/delivered`}
        {clicks > 0 && ` · ${clicks.toLocaleString()} clicks`}
      </p>
    </li>
  )
}
