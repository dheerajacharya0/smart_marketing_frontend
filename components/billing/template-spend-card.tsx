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
import { metaFiguresErrorText, needsReconnect } from "@/lib/meta-figures-error"
import { rowCost, rowDetail, rowTitles } from "@/lib/template-spend"
import type { TemplateSpend, WabaTemplateSpend } from "@/services/api"

const ROWS_SHOWN = 5

/**
 * Sends and cost per template. Counts come from the backend's own send records
 * (Meta's template counters stay 0 until the owner confirms template insights,
 * and never backfill); cost is Meta's template_analytics, with the backend's
 * rate-card estimate (marked ~) where Meta's is missing. A WABA where the
 * owner hasn't confirmed template analytics says so above its rows — we never
 * flip that confirmation ourselves, since Meta documents it as a one-way switch
 * that also turns on link tracking and chat-data collection for the account.
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
          How each template&apos;s sends went in this range, and what Meta charged for them. Meta
          bills your WhatsApp Business account directly; Converszio adds nothing on top.
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
            Counts are from messages sent from here. Costs are Meta&apos;s own figures, before
            tax: approximate and a few hours behind. ~ marks our estimate where Meta has none.{" "}
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

/**
 * Meta's state for this WABA, shown *above* the list rather than instead of
 * it: the counts are ours and come through whatever Meta says, so a refusal
 * only costs the Meta cost column, never the rows.
 */
function MetaNotice({ spend }: { spend: WabaTemplateSpend }) {
  if (spend.status === "not_enabled") {
    return (
      <div className="flex flex-wrap items-start gap-2 rounded-md border border-dashed bg-muted/30 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-muted-foreground">
          Template analytics isn&apos;t turned on for this WhatsApp account, so Meta doesn&apos;t
          report cost per template. Costs below marked ~ are our estimate. Turning it on in WhatsApp
          Manager is a one-time, one-way switch on Meta&apos;s side, so we don&apos;t flip it for you.
        </p>
        <Button asChild variant="outline" size="sm" className="h-8 shrink-0">
          <a href="https://business.facebook.com/wa/manage/home/" target="_blank" rel="noopener noreferrer">
            Open WhatsApp Manager <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </Button>
      </div>
    )
  }
  if (spend.status === "error") {
    return (
      <div className="flex flex-wrap items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="min-w-0 flex-1">
          {metaFiguresErrorText(spend.error)}
          {spend.templates.length > 0 && " Counts below are from your sends here; costs marked ~ are our estimate."}
        </p>
        {needsReconnect(spend.errorCode) && (
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href="/dashboard/whatsapp/new">Reconnect</Link>
          </Button>
        )}
      </div>
    )
  }
  if (spend.status === "cost_unavailable") {
    return (
      <p className="text-xs text-muted-foreground">
        Billed through Converszio&apos;s partner line, so Meta doesn&apos;t report cost here.
      </p>
    )
  }
  return null
}

function WabaTemplates({ spend, label }: { spend: WabaTemplateSpend; label: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const header = label && (
    <p className="text-xs font-medium text-muted-foreground" title={`WhatsApp account ${spend.wabaId}`}>
      {label}
    </p>
  )

  const shown = expanded ? spend.templates : spend.templates.slice(0, ROWS_SHOWN)
  const rest = spend.templates.length - ROWS_SHOWN
  const titles = rowTitles(spend.templates)

  return (
    <div className="space-y-3">
      {header}
      <MetaNotice spend={spend} />
      {spend.templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates sent in this range.</p>
      ) : (
        <ul className="divide-y rounded-md border" aria-label="By template">
          {shown.map((t) => (
            <TemplateRow key={t.templateId} t={t} spend={spend} title={titles.get(t.templateId) ?? ""} />
          ))}
        </ul>
      )}
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

function TemplateRow({ t, spend, title }: { t: TemplateSpend; spend: WabaTemplateSpend; title: string }) {
  const cost = rowCost(t, spend)
  const metaMoney = (n: number) => formatMoney(n, spend.currency ?? undefined)
  return (
    <li className="space-y-1 px-3 py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate" title={t.templateId}>
          {title}
        </span>
        <span
          className={cn("shrink-0 tabular-nums", cost.kind === "estimate" && "text-muted-foreground")}
          title={
            cost.kind === "meta"
              ? "Meta's own figure, before tax. Approximate."
              : cost.kind === "estimate"
                ? `Our estimate for ${(t.charged ?? 0).toLocaleString()} charged message${t.charged === 1 ? "" : "s"}, from Meta's rate card, including tax.`
                : undefined
          }
        >
          {cost.kind === "meta" || cost.kind === "estimate"
            ? `${cost.kind === "estimate" ? "~" : ""}${formatMoney(cost.amount, cost.currency)}`
            : cost.kind === "free"
              ? formatMoney(0, cost.currency)
              : "—"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{rowDetail(t, cost, metaMoney)}</p>
    </li>
  )
}
