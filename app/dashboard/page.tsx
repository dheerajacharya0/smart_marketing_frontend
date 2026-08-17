"use client"

import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { AlertCircle, BarChart3, Megaphone, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { StatStrip, type Stat } from "@/components/stat-strip"
import { SetupChecklist } from "@/components/setup-checklist"
import { RateInterpretation } from "@/components/rate-interpretation"
import {
  DELIVERY_BENCHMARK,
  FAILURE_BENCHMARK,
  READ_BENCHMARK,
  REPLY_BENCHMARK,
  rateHint,
  verdictTone,
} from "@/lib/benchmarks"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getFacebookAccounts,
  getAnalyticsOverview,
  getMessagingAnalytics,
  type AnalyticsOverview,
  type MessagingAnalytics,
} from "@/services/api"
import { DateRangePicker, DEFAULT_RANGE, type AnalyticsRange } from "./date-range-picker"
import { MessagingVolumeChart } from "./messaging-volume-chart"
import { intervalForRange } from "./analytics-utils"

function CardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="h-6 w-6 text-destructive mb-2" />
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  )
}

// Ordinal blue ramp (light: steps 250→550, dark: 300→600) — deeper engagement, darker step.
const FUNNEL_STAGES = [
  { key: "sentCount", label: "Sent", barClass: "bg-[#86b6ef] dark:bg-[#6da7ec]" },
  { key: "deliveredCount", label: "Delivered", barClass: "bg-[#5598e7] dark:bg-[#3987e5]" },
  { key: "readCount", label: "Read", barClass: "bg-[#2a78d6] dark:bg-[#256abf]" },
  { key: "repliedCount", label: "Replied", barClass: "bg-[#1c5cab] dark:bg-[#184f95]" },
] as const

const CAMPAIGN_STATUSES = [
  { key: "scheduled", label: "Scheduled" },
  { key: "running", label: "Running" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const

export default function DashboardPage() {
  const [accountId, setAccountId] = useState<string | null>(null)
  const [accountResolved, setAccountResolved] = useState(false)
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_RANGE)

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const [messaging, setMessaging] = useState<MessagingAnalytics | null>(null)
  const [messagingLoading, setMessagingLoading] = useState(true)
  const [messagingError, setMessagingError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) {
        setAccountResolved(true)
        return
      }
      try {
        const ctx = await getActiveWhatsappContext()
        if (ctx) {
          setAccountId(ctx.accountId)
          return
        }
        const accounts = await getFacebookAccounts()
        const fbAccount = (accounts || []).find((a) => a.type === "facebook")
        if (fbAccount) setAccountId(fbAccount.id)
      } catch (err) {
        console.error("Failed to resolve account:", err)
      } finally {
        setAccountResolved(true)
      }
    }
    init()
  }, [])

  const fromIso = range.from.toISOString()
  const toIso = range.to.toISOString()

  const fetchOverview = useCallback(async () => {
    if (!accountId) return
    setOverviewLoading(true)
    setOverviewError(null)
    try {
      const res = await getAnalyticsOverview(accountId, fromIso, toIso)
      setOverview(res)
    } catch (err) {
      setOverviewError(getErrorMessage(err) || "Failed to load overview")
    } finally {
      setOverviewLoading(false)
    }
  }, [accountId, fromIso, toIso])

  const fetchMessaging = useCallback(async () => {
    if (!accountId) return
    setMessagingLoading(true)
    setMessagingError(null)
    try {
      const interval = intervalForRange(range.from, range.to)
      const res = await getMessagingAnalytics(accountId, fromIso, toIso, interval)
      setMessaging(res)
    } catch (err) {
      setMessagingError(getErrorMessage(err) || "Failed to load messaging volume")
    } finally {
      setMessagingLoading(false)
    }
  }, [accountId, fromIso, toIso, range.from, range.to])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  useEffect(() => {
    fetchMessaging()
  }, [fetchMessaging])

  const r = overview?.recipients
  const rates = overview?.rates

  // Benchmark hints (§8 revamp): thresholds, wording and tone all come from
  // lib/benchmarks.ts so the tiles here, the campaign detail tiles and the
  // interpretation panel below can't disagree about what "good" is.
  const statTiles: Stat[] = r && rates
    ? [
        { label: "Messages sent", value: r.sentCount.toLocaleString() },
        {
          label: "Delivered",
          value: r.deliveredCount.toLocaleString(),
          hint: rateHint(DELIVERY_BENCHMARK, rates.deliveryRate),
          tone: verdictTone(DELIVERY_BENCHMARK, DELIVERY_BENCHMARK.verdict(rates.deliveryRate)),
        },
        {
          label: "Read",
          value: r.readCount.toLocaleString(),
          hint: rateHint(READ_BENCHMARK, rates.readRate),
          tone: verdictTone(READ_BENCHMARK, READ_BENCHMARK.verdict(rates.readRate)),
        },
        {
          label: "Replies",
          value: r.repliedCount.toLocaleString(),
          hint: rateHint(REPLY_BENCHMARK, rates.replyRate),
        },
        {
          label: "Failed",
          value: r.failedCount.toLocaleString(),
          hint: rateHint(FAILURE_BENCHMARK, rates.failureRate),
          tone: verdictTone(FAILURE_BENCHMARK, FAILURE_BENCHMARK.verdict(rates.failureRate)),
        },
      ]
    : []

  const funnelPct = (value: number) =>
    r && r.sentCount > 0 ? Math.min(100, Math.round((value / r.sentCount) * 100)) : 0

  if (accountResolved && !accountId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Delivery and engagement across your campaigns." />
        {/* Nothing to chart yet — the checklist is the useful thing to show a
            brand-new account, and its first step is the Connect action. */}
        <SetupChecklist accountId={null} />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={BarChart3}
              title="No connected account yet"
              description="Link a Facebook/WhatsApp account to see your delivery and engagement analytics."
              action={
                <Button asChild>
                  <Link href="/dashboard/whatsapp">Connect WhatsApp</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Delivery and engagement across your campaigns."
        actions={<DateRangePicker range={range} onChange={setRange} />}
      />

      {/* Self-hiding: renders nothing once every step passes or it's dismissed. */}
      <SetupChecklist accountId={accountId} />

      {/* Stat tiles */}
      {overviewError ? (
        <Card>
          <CardContent>
            <CardError message={overviewError} onRetry={fetchOverview} />
          </CardContent>
        </Card>
      ) : overviewLoading || !r ? (
        <div className="hud-strip">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="hud-stat space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <StatStrip stats={statTiles} />
      )}

      {/* Renders nothing until there's something sent to interpret. */}
      <RateInterpretation rates={rates} sentCount={r?.sentCount ?? 0} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Campaigns summary */}
        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>In selected range</CardDescription>
          </CardHeader>
          <CardContent>
            {overviewError ? (
              <CardError message={overviewError} onRetry={fetchOverview} />
            ) : overviewLoading || !overview ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-20" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-accent p-2">
                    <Megaphone className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <p className="text-3xl font-bold">{overview.campaigns.total}</p>
                </div>
                <div className="space-y-1">
                  {CAMPAIGN_STATUSES.map((s) => (
                    <Link
                      key={s.key}
                      href={`/dashboard/campaigns?status=${s.key}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-medium">{overview.campaigns.byStatus[s.key] ?? 0}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Engagement funnel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Engagement Funnel</CardTitle>
            <CardDescription>Sent → Delivered → Read → Replied, as % of sent</CardDescription>
          </CardHeader>
          <CardContent>
            {overviewError ? (
              <CardError message={overviewError} onRetry={fetchOverview} />
            ) : overviewLoading || !r ? (
              <div className="space-y-4 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3 py-2">
                {FUNNEL_STAGES.map((stage) => {
                  const value = r[stage.key]
                  return (
                    <div key={stage.key} className="flex items-center gap-3">
                      <span className="w-20 text-sm text-muted-foreground">{stage.label}</span>
                      <div className="flex-1 h-6 rounded-md bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-md transition-all ${stage.barClass}`}
                          style={{ width: `${funnelPct(value)}%` }}
                        />
                      </div>
                      <span className="w-32 text-right text-sm">
                        <span className="font-medium">{value.toLocaleString()}</span>{" "}
                        <span className="text-muted-foreground">({funnelPct(value)}%)</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Messaging volume */}
      <Card>
        <CardHeader>
          <CardTitle>Messaging Volume</CardTitle>
          <CardDescription>Inbound vs outbound messages over time</CardDescription>
        </CardHeader>
        <CardContent>
          {messagingError ? (
            <CardError message={messagingError} onRetry={fetchMessaging} />
          ) : messagingLoading || !messaging ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <MessagingVolumeChart data={messaging} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
