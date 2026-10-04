"use client"

import { swallow } from "@/lib/observability"
import { useCallback, useEffect, useMemo, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookUser,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Send,
  Upload,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { MetricCard, MetricRow, type MetricCardProps } from "@/components/metric-card"
import { StatusPill } from "@/components/status-pill"
import { ActivityFeed } from "@/components/activity-feed"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { AuroraBackdrop } from "@/components/ui/surface"
import { SetupChecklist } from "@/components/setup-checklist"
import { MetaSpendCard } from "@/components/billing/meta-spend-card"
import { RateInterpretation } from "@/components/rate-interpretation"
import { InsightBanner } from "@/components/insight-banner"
import { dashboardInsight } from "@/lib/insights"
import {
  DELIVERY_BENCHMARK,
  FAILURE_BENCHMARK,
  READ_BENCHMARK,
  REPLY_BENCHMARK,
  CLICK_BENCHMARK,
  rateHint,
} from "@/lib/benchmarks"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getFacebookAccounts,
  getAnalyticsOverview,
  getMessagingAnalytics,
  listCampaigns,
  listContacts,
  type AnalyticsOverview,
  type Campaign,
  type MessagingAnalytics,
} from "@/services/api"
import { DateRangePicker, DEFAULT_RANGE, type AnalyticsRange } from "./date-range-picker"
import { MessagingVolumeChart } from "./messaging-volume-chart"
import { intervalForRange } from "./analytics-utils"
import { formatMoney } from "@/lib/money"
import { useAlerts, useWallet } from "@/hooks/use-queries"
import { useAccountRole } from "@/hooks/use-account-role"
import { canOpen } from "@/lib/access"
import { cn } from "@/lib/utils"
import { forActiveNumber } from "@/lib/active-number-scope"

function CardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="mb-2 h-6 w-6 text-destructive" />
      <p className="mb-3 text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  )
}

// Ordinal ramp: each deeper stage is a stronger, brighter pass of the brand
// gradient, so engagement reads as "heating up" down the funnel.
const FUNNEL_STAGES = [
  { key: "sentCount", label: "Sent", strength: 0.45 },
  { key: "deliveredCount", label: "Delivered", strength: 0.65 },
  { key: "readCount", label: "Read", strength: 0.85 },
  { key: "repliedCount", label: "Replied", strength: 1 },
] as const

const CAMPAIGN_STATUSES = [
  { key: "scheduled", label: "Scheduled" },
  { key: "running", label: "Running" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const

const QUICK_ACTIONS = [
  { href: "/dashboard/campaigns?new=1", label: "Send a broadcast", icon: Send },
  { href: "/dashboard/contacts?import=1", label: "Import contacts", icon: Upload },
  { href: "/dashboard/chat", label: "Open inbox", icon: MessageSquare },
  { href: "/dashboard/billing", label: "Top up wallet", icon: Wallet },
] as const

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export default function DashboardPage() {
  const [accountId, setAccountId] = useState<string | null>(null)
  // The number the dashboard is working on; stats and the timeline narrow to
  // it. Unset with no registered number, which reads the whole account.
  const [phoneNumberId, setPhoneNumberId] = useState<string | undefined>(undefined)
  const [accountResolved, setAccountResolved] = useState(false)
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_RANGE)
  const [firstName, setFirstName] = useState<string>("")

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const [messaging, setMessaging] = useState<MessagingAnalytics | null>(null)
  const [messagingLoading, setMessagingLoading] = useState(true)
  const [messagingError, setMessagingError] = useState<string | null>(null)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) {
        setAccountResolved(true)
        return
      }
      setFirstName((user.name || "").split(" ")[0] || "")
      try {
        const ctx = await getActiveWhatsappContext()
        if (ctx) {
          setAccountId(ctx.accountId)
          setPhoneNumberId(ctx.phoneNumberId)
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
      const res = await getAnalyticsOverview(accountId, fromIso, toIso, phoneNumberId)
      setOverview(res)
    } catch (err) {
      setOverviewError(getErrorMessage(err) || "Failed to load overview")
    } finally {
      setOverviewLoading(false)
    }
  }, [accountId, fromIso, toIso, phoneNumberId])

  const fetchMessaging = useCallback(async () => {
    if (!accountId) return
    setMessagingLoading(true)
    setMessagingError(null)
    try {
      const interval = intervalForRange(range.from, range.to)
      const res = await getMessagingAnalytics(accountId, fromIso, toIso, interval, phoneNumberId)
      setMessaging(res)
    } catch (err) {
      setMessagingError(getErrorMessage(err) || "Failed to load messaging volume")
    } finally {
      setMessagingLoading(false)
    }
  }, [accountId, fromIso, toIso, range.from, range.to, phoneNumberId])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  useEffect(() => {
    fetchMessaging()
  }, [fetchMessaging])

  // Campaign list feeds the activity timeline. A failure here must not take the
  // page down — the timeline just falls back to alerts only.
  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    setCampaignsLoading(true)
    listCampaigns(accountId)
      .then((res) => {
        if (!cancelled) setCampaigns(forActiveNumber(Array.isArray(res) ? res : [], phoneNumberId))
      })
      .catch(swallow("app/dashboard/page.tsx"))
      .finally(() => {
        if (!cancelled) setCampaignsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountId, phoneNumberId])

  // How many contacts exist at all, for the "you have contacts and haven't sent
  // anything" nudge. A `limit: 1` read for its `total`, once per account — the
  // dashboard never lists contacts otherwise.
  const [contactCount, setContactCount] = useState<number | null>(null)
  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    listContacts(accountId, { limit: 1 })
      .then((res) => {
        if (!cancelled) setContactCount(res.total ?? 0)
      })
      .catch(swallow("app/dashboard/page.tsx"))
    return () => {
      cancelled = true
    }
  }, [accountId])

  const { role, can } = useAccountRole()
  const { data: alerts } = useAlerts(accountId, can("manager"))
  // The revenue summary carries no currency of its own — an account bills in
  // exactly one, and a conversion in any other is refused at write time rather
  // than converted, so the wallet's currency is the right (and only) source.
  const { data: wallet } = useWallet(accountId)
  const currency = wallet?.currency

  const r = overview?.recipients
  const rates = overview?.rates

  // Benchmark hints (§8 revamp): thresholds and wording come from
  // lib/benchmarks.ts so the tiles here, the campaign detail tiles and the
  // interpretation panel below can't disagree about what "good" is. The hint
  // becomes the tile's plain-English read rather than a colour on the number.
  //
  // Deliberately no sparklines here. The only series available is
  // `messaging.points`, which counts every message on the account's numbers —
  // inbox replies, drip and flow sends included — while these values are sums
  // of campaign counters. A trend line drawn from a different population than
  // the number above it is worse than no trend line: it moves when the number
  // doesn't, and nothing on screen explains why.
  const statTiles: MetricCardProps[] = r && rates
    ? [
        { label: "Messages sent", value: r.sentCount, featured: true },
        { label: "Delivered", value: r.deliveredCount, read: rateHint(DELIVERY_BENCHMARK, rates.deliveryRate) },
        { label: "Read", value: r.readCount, read: rateHint(READ_BENCHMARK, rates.readRate) },
        {
          label: "Replies",
          value: r.repliedCount,
          read: rateHint(REPLY_BENCHMARK, rates.replyRate),
        },
        // Only shown once something has actually been clicked. A permanent "0
        // clicks" tile on an account that never tracked a link reads as a
        // failure rather than as a feature nobody switched on.
        ...(r.clickedCount > 0
          ? [{ label: "Link clicks", value: r.clickedCount, read: rateHint(CLICK_BENCHMARK, rates.clickRate) }]
          : []),
        {
          label: "Failed",
          value: r.failedCount,
          read: rateHint(FAILURE_BENCHMARK, rates.failureRate),
          // An increase in failures is bad news, so the delta colours invert.
          invertDelta: true,
        },
      ]
    : []

  const funnelPct = (value: number) =>
    r && r.sentCount > 0 ? Math.min(100, Math.round((value / r.sentCount) * 100)) : 0

  // Only once a sale has been reported. Revenue can't be derived here — we
  // don't sell the customer's products and Meta reports nothing about them — so
  // an empty revenue card would read as a broken measurement rather than as an
  // integration nobody has connected.
  const revenue = overview?.revenue
  const hasRevenue = (revenue?.conversions ?? 0) > 0
  const attributedShare =
    revenue && revenue.revenue > 0 ? Math.round((revenue.attributedRevenue / revenue.revenue) * 100) : 0

  // One contextual, plain-language observation. Derived from numbers already on
  // screen — never a generic tip, and nothing at all if there's nothing to say.
  // Thresholds and wording live in lib/insights.ts, not here: the same rules
  // run on the contacts, campaigns and drips screens, and a copy of them inline
  // is how the dashboard ended up with its own private failure-rate bar that
  // disagreed with lib/benchmarks.
  const insight = useMemo(
    () =>
      dashboardInsight({
        ...(r ? { recipients: r } : {}),
        ...(overview ? { campaigns: overview.campaigns } : {}),
        walletBalance: wallet?.balance ?? null,
        ...(contactCount != null ? { contactCount } : {}),
      }),
    [r, overview, wallet?.balance, contactCount],
  )

  if (accountResolved && !accountId) {
    return (
      <div className="space-y-6">
        <div className="relative isolate -mx-1 px-1">
          <AuroraBackdrop className="rounded-xl" />
          <div className="relative z-10">
            <PageHeader
              eyebrow="Getting started"
              title="Welcome aboard"
              description="Connect a WhatsApp number and this page fills with your delivery and engagement numbers."
            />
          </div>
        </div>

        {/* Nothing to chart yet — the checklist is the useful thing to show a
            brand-new account, and its first step is the Connect action. */}
        <SetupChecklist accountId={null} />

        <Card className="overflow-hidden">
          <EmptyState
            icon={BarChart3}
            title="No connected account yet"
            description="Link a Facebook or WhatsApp Business account to see delivery and engagement analytics."
            action={
              <Button asChild>
                <Link href="/dashboard/whatsapp">Connect WhatsApp</Link>
              </Button>
            }
            hint="You'll need a Facebook Business account and a phone number that isn't already registered on WhatsApp."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ---------------- Welcome ---------------- */}
      {/* The rounding and clipping belong to the ambient wash, not to this
          box. While they sat here, `-mx-1 px-1` put the eyebrow's first
          glyph 4px right and 2px below the corner — inside a 20px radius,
          so `overflow-hidden` shaved the top-left off its first letter.
          `.aurora-backdrop` is `absolute inset-0` with only background
          gradients, so it clips itself; nothing here needed to. */}
      <section className="relative isolate -mx-1 px-1">
        <AuroraBackdrop className="rounded-xl" />
        <div className="relative z-10 flex flex-col gap-5 pb-1 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            className="mb-0"
            // Uppercased and letter-spaced, the long form runs to ~360px —
            // wider than the content column on a phone, so it broke after
            // "WEDNESDAY," and left the date stranded on its own line. Same
            // date, abbreviated, until there is room for the full one.
            eyebrow={
              <>
                <span className="sm:hidden">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="hidden sm:inline">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </>
            }
            title={firstName ? `${greeting()}, ${firstName}` : greeting()}
            description="Here's how your messaging is performing."
          />
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker range={range} onChange={setRange} />
          </div>
        </div>

        {/* Quick actions read as a row of affordances, not another card grid. */}
        <div className="relative z-10 mt-4 flex snap-x gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
          {QUICK_ACTIONS.filter((action) => !role || canOpen(role, action.href)).map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "focus-ring group flex shrink-0 snap-start items-center gap-2 rounded-full border border-border-subtle",
                "bg-surface-2/70 py-2 pl-3 pr-3.5 text-sm text-foreground-secondary shadow-xs",
                "transition-all duration-base ease-out-soft",
                "hover:border-primary/30 hover:text-foreground hover:shadow-sm",
              )}
            >
              <action.icon className="h-4 w-4 text-primary" />
              {action.label}
              <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-base ease-out-soft group-hover:translate-x-0 group-hover:opacity-60" />
            </Link>
          ))}
        </div>
      </section>

      {/* Self-hiding: renders nothing once every step passes or it's dismissed.
          Not before the account resolves: with no id yet it would read as a
          brand-new account and flash "0 of 7 done" at an established one. */}
      {/* Setup is the owner's or an admin's job; an agent can't act on most
          of its steps (billing, Meta payment, number registration). */}
      {accountResolved && can("manager") && <SetupChecklist accountId={accountId} />}

      {/* ---------------- Key metrics ----------------
          Scope stated on purpose. Every number in this block is a sum of
          campaign counters ranged on when the campaign was *created*, so an
          account that only ever chats from the inbox reads zero here while the
          volume chart below shows its real traffic. Two populations on one page
          need saying out loud, or the page looks broken to whoever's messaging
          doesn't run through campaigns. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-medium text-foreground">Campaign performance</h2>
        <p className="text-xs text-muted-foreground">
          Broadcasts created in this range. One-to-one replies, drips and flows aren&apos;t counted
          here.
        </p>
      </div>
      {overviewError ? (
        <Card>
          <CardContent className="pt-6">
            <CardError message={overviewError} onRetry={fetchOverview} />
          </CardContent>
        </Card>
      ) : overviewLoading || !r ? (
        <MetricRow>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2 rounded-lg border border-border-subtle bg-card p-3.5 shadow-sm sm:p-4"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </MetricRow>
      ) : (
        <MetricRow>
          {/* Entrance stagger is capped at 8 tiles by the index we pass. */}
          {statTiles.map((tile, i) => (
            <MetricCard key={String(tile.label)} {...tile} index={Math.min(i, 7)} />
          ))}
        </MetricRow>
      )}

      {/* ---------------- Insight ---------------- */}
      <InsightBanner insight={insight} />

      {/* Renders nothing until there's something sent to interpret. */}
      <RateInterpretation rates={rates} sentCount={r?.sentCount ?? 0} />

      {/* Meta's own charges for the same range. Managers only, like the
          wallet and billing pages it sits beside. */}
      {accountId && can("manager") && <MetaSpendCard accountId={accountId} from={range.from} to={range.to} />}

      {/* ---------------- Analytics + activity ----------------
          Deliberately asymmetric: the chart earns the width, the timeline is a
          narrow rail beside it. Two equal columns would read as a template. */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card variant="analytics" className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Messaging volume</CardTitle>
            {/* Wider than the tiles above on purpose, and said so: this counts
                every message on the account's numbers, campaign or not. */}
            <CardDescription>
              Every message on your numbers — campaigns, inbox replies, drips and flows alike
            </CardDescription>
          </CardHeader>
          <CardContent>
            {messagingError ? (
              <CardError message={messagingError} onRetry={fetchMessaging} />
            ) : messagingLoading || !messaging ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <MessagingVolumeChart data={messaging} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Campaign milestones and number-health alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed
              campaigns={campaigns}
              alerts={alerts ?? []}
              loading={campaignsLoading && campaigns.length === 0}
            />
          </CardContent>
        </Card>
      </div>

      {/* ---------------- Funnel + campaign status ---------------- */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Card variant="elevated" className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Engagement funnel</CardTitle>
            <CardDescription>
              Campaign sends: sent → delivered → read → replied, as a share of sent
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overviewError ? (
              <CardError message={overviewError} onRetry={fetchOverview} />
            ) : overviewLoading || !r ? (
              <div className="space-y-4 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3.5 py-1">
                {FUNNEL_STAGES.map((stage, i) => {
                  const value = r[stage.key]
                  return (
                    <div
                      key={stage.key}
                      style={{ "--signal-index": i } as React.CSSProperties}
                      className="signal-rise flex items-center gap-3"
                    >
                      <span className="w-20 shrink-0 text-sm text-muted-foreground">{stage.label}</span>
                      <div className="h-2.5 flex-1 rounded-full bg-muted/70">
                        <div
                          className="h-full rounded-full transition-[width] duration-slow ease-out-soft"
                          style={{
                            width: `${funnelPct(value)}%`,
                            opacity: stage.strength,
                            background:
                              "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent-vivid)))",
                            boxShadow: `0 0 ${Math.round(12 * stage.strength)}px hsl(var(--primary) / 0.45)`,
                          }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right text-sm">
                        <AnimatedNumber value={value} className="font-medium text-foreground" />{" "}
                        <span className="text-muted-foreground">({funnelPct(value)}%)</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Campaigns</CardTitle>
                <CardDescription>In the selected range</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="-mr-2 shrink-0">
                <Link href="/dashboard/campaigns">
                  All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {overviewError ? (
              <CardError message={overviewError} onRetry={fetchOverview} />
            ) : overviewLoading || !overview ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-20" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary">
                    <Megaphone className="h-5 w-5" />
                  </span>
                  <div>
                    <AnimatedNumber
                      value={overview.campaigns.total}
                      className="font-display text-2xl font-semibold text-foreground"
                    />
                    <p className="text-xs text-muted-foreground">total campaigns</p>
                  </div>
                </div>

                <div className="space-y-0.5">
                  {/* Status reads in the tick language, same as everywhere else. */}
                  {CAMPAIGN_STATUSES.map((s) => (
                    <Link
                      key={s.key}
                      href={`/dashboard/campaigns?status=${s.key}`}
                      className="focus-ring flex min-h-[44px] items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors duration-fast ease-out-soft hover:bg-accent/60 sm:min-h-0"
                    >
                      <StatusPill status={s.key} label={s.label} live={s.key === "running"} />
                      <span className="font-mono font-medium tabular-nums text-foreground-secondary">
                        {overview.campaigns.byStatus[s.key] ?? 0}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------------- Revenue ---------------- */}
      {hasRevenue && revenue && (
        <Card variant="soft">
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <CardDescription>
              Sales your store or CRM reported in this period, by when the sale happened.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-label text-muted-foreground">
                Total reported
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {formatMoney(revenue.revenue, currency)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {revenue.conversions} sale{revenue.conversions === 1 ? "" : "s"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-label text-muted-foreground">
                Touched by messaging
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {formatMoney(revenue.attributedRevenue, currency)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {revenue.attributedConversions} of {revenue.conversions} attributed
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-label text-muted-foreground">
                Share attributed
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{attributedShare}%</p>
              {/* The gap isn't a failure to measure: a sale outside the
                  attribution window, or from someone we never messaged, is a
                  sale that happened anyway. */}
              <p className="mt-0.5 text-xs text-muted-foreground">
                the rest happened outside the attribution window
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* A quiet way out of the dashboard rather than a dead end at the fold. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle/70 bg-muted/40 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Looking for someone in particular? Search contacts, campaigns, and templates from anywhere with ⌘K.
        </p>
        <Button asChild variant="soft" size="sm">
          <Link href="/dashboard/contacts">
            <BookUser className="h-3.5 w-3.5" /> Browse contacts
          </Link>
        </Button>
      </div>
    </div>
  )
}
