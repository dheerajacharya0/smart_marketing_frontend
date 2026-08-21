"use client"

import { swallow } from "@/lib/observability"
import { useCallback, useEffect, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  PauseCircle,
  PlayCircle,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
import { toast } from "react-hot-toast"
import Link from "next/link"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getCampaign,
  getCampaignAnalytics,
  getSegment,
  listCampaignRecipients,
  cancelCampaign,
  pauseCampaign,
  resumeCampaign,
  type Campaign,
  type CampaignAnalytics,
  type CampaignRecipient,
  type CampaignRecipientStatus,
  type Segment,
} from "@/services/api"
import {
  CampaignStatusBadge,
  RecipientStatusBadge,
  canCancelCampaign,
  canPauseCampaign,
  canResumeCampaign,
  isCampaignActive,
} from "../campaign-badges"
import { CampaignDeferredBanner } from "../campaign-deferred-banner"
import { RateInterpretation } from "@/components/rate-interpretation"
import { Explain } from "@/components/explain"
import { formatMoney } from "@/lib/money"
import { CampaignTimelineChart } from "./campaign-timeline-chart"

const POLL_INTERVAL_MS = 5000
const PAGE_SIZE = 20
// "Replied" is a timestamp, not a recipient status — the backend has no
// status=replied filter, so we fetch a capped window and filter client-side.
const REPLIED_FETCH_LIMIT = 500

type StatusTab = "all" | "replied" | CampaignRecipientStatus

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "delivered", label: "Delivered" },
  { value: "read", label: "Read" },
  { value: "replied", label: "Replied" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
]

export default function CampaignDetailPage() {
  const params = useParams<{ campaignId: string }>()
  const campaignId = params.campaignId
  const router = useRouter()

  const [accountId, setAccountId] = useState<string | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null)
  // null = not yet resolved; defaults to hour for campaigns started <48h ago
  const [chartInterval, setChartInterval] = useState<"hour" | "day" | null>(null)
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([])
  const [recipientsTotal, setRecipientsTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<StatusTab>("all")
  const [offset, setOffset] = useState(0)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isPausing, setIsPausing] = useState(false)
  const [audienceSegment, setAudienceSegment] = useState<Segment | null>(null)

  // Resolve the segment name for the audience chip when the campaign targeted one
  useEffect(() => {
    if (!accountId || !campaign?.segmentId) return
    getSegment(campaign.segmentId, accountId)
      .then((res) => setAudienceSegment(res))
      .catch(swallow("app/dashboard/campaigns/[campaignId]/page.tsx"))
  }, [accountId, campaign?.segmentId])

  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) {
        setIsLoading(false)
        return
      }
      try {
        const ctx = await getActiveWhatsappContext()
        if (!ctx) {
          setIsLoading(false)
          return
        }
        setAccountId(ctx.accountId)
      } catch (err) {
        console.error("Failed to resolve account:", err)
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const fetchAll = useCallback(
    async (showSpinner = false) => {
      if (!accountId || !campaignId) return
      if (showSpinner) setIsLoading(true)
      try {
        const recipientsPromise =
          statusTab === "replied"
            ? listCampaignRecipients(campaignId, accountId, { limit: REPLIED_FETCH_LIMIT, offset: 0 })
            : listCampaignRecipients(campaignId, accountId, {
                status: statusTab === "all" ? undefined : statusTab,
                limit: PAGE_SIZE,
                offset,
              })
        const [campaignRes, analyticsRes, recipientsRes] = await Promise.all([
          getCampaign(campaignId, accountId),
          getCampaignAnalytics(campaignId, accountId, chartInterval ?? "day").catch(() => null),
          recipientsPromise,
        ])
        setCampaign(campaignRes || null)
        if (analyticsRes) {
          setAnalytics(analyticsRes)
        }
        const items: CampaignRecipient[] = Array.isArray(recipientsRes.items) ? recipientsRes.items : []
        if (statusTab === "replied") {
          const replied = items.filter((r) => r.repliedAt)
          setRecipients(replied.slice(offset, offset + PAGE_SIZE))
          setRecipientsTotal(replied.length)
        } else {
          setRecipients(items)
          setRecipientsTotal(recipientsRes.total ?? 0)
        }
      } catch (err) {
        if (showSpinner) toast.error(getErrorMessage(err) || "Failed to load campaign")
      } finally {
        if (showSpinner) setIsLoading(false)
      }
    },
    [accountId, campaignId, statusTab, offset, chartInterval]
  )

  useEffect(() => {
    fetchAll(true)
  }, [fetchAll])

  // Default the timeline to hourly buckets for campaigns started <48h ago.
  useEffect(() => {
    if (!campaign || chartInterval !== null) return
    const startedRecently =
      !!campaign.startedAt && Date.now() - new Date(campaign.startedAt).getTime() < 48 * 60 * 60 * 1000
    setChartInterval(startedRecently ? "hour" : "day")
  }, [campaign, chartInterval])

  // Poll while scheduled/running — silent so the tables don't flicker.
  const active = isCampaignActive(campaign?.status)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    if (!accountId || !active) return
    const timer = setInterval(() => {
      if (activeRef.current) fetchAll(false)
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [accountId, active, fetchAll])

  const handleCancel = async () => {
    if (!accountId || !campaign) return
    setIsCancelling(true)
    try {
      await cancelCampaign(campaign.id, accountId)
      toast.success("Campaign cancelled")
      fetchAll(false)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to cancel campaign")
    } finally {
      setIsCancelling(false)
    }
  }

  const handlePauseResume = async (action: "pause" | "resume") => {
    if (!accountId || !campaign) return
    setIsPausing(true)
    try {
      const updated =
        action === "pause"
          ? await pauseCampaign(campaign.id, accountId)
          : await resumeCampaign(campaign.id, accountId)
      // Resume picks scheduled or running server-side depending on whether the
      // campaign had started, so report what came back rather than guessing.
      toast.success(action === "pause" ? "Campaign paused" : `Campaign ${updated.status}`)
      fetchAll(false)
    } catch (err) {
      toast.error(getErrorMessage(err) || `Failed to ${action} campaign`)
    } finally {
      setIsPausing(false)
    }
  }

  const formatDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "—")

  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

  const from = recipientsTotal === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, recipientsTotal)

  if (isLoading && !campaign) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/campaigns")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to campaigns
        </Button>
        <p className="text-muted-foreground">Campaign not found.</p>
      </div>
    )
  }

  // Pre-computed backend rates when available; fall back to local % of sent.
  const rates = analytics?.rates
  const repliedCount = campaign.repliedCount ?? analytics?.campaign?.repliedCount ?? 0

  const stats: { label: string; value: number; sub?: string; info?: string; onClick?: () => void }[] = [
    { label: "Total", value: campaign.totalRecipients },
    { label: "Sent", value: campaign.sentCount },
    {
      label: "Delivered",
      value: campaign.deliveredCount,
      sub: rates
        ? `${rates.deliveryRate}% of sent`
        : campaign.sentCount > 0
          ? `${pct(campaign.deliveredCount, campaign.sentCount)}% of sent`
          : undefined,
    },
    {
      label: "Read",
      value: campaign.readCount,
      sub: rates
        ? `${rates.readRate}% of sent`
        : campaign.sentCount > 0
          ? `${pct(campaign.readCount, campaign.sentCount)}% of sent`
          : undefined,
    },
    {
      label: "Replies",
      value: repliedCount,
      sub: rates ? `${rates.replyRate}% reply rate` : undefined,
      onClick: () => {
        setStatusTab("replied")
        setOffset(0)
      },
    },
    // Only for a campaign that tracked its links. On one that didn't, a 0%
    // click rate isn't a result — nobody could have been counted, and people
    // may well have clicked a plain URL that's invisible to us.
    ...(campaign.trackLinks
      ? [
          {
            label: "Link clicks",
            value: campaign.clickedCount ?? 0,
            sub: rates ? `${rates.clickRate}% of sent clicked` : undefined,
            info: "Counts people, not clicks — someone who taps the same link twice is one.",
          },
        ]
      : []),
    {
      label: "Failed",
      value: campaign.failedCount,
      sub: rates ? `${rates.failureRate}% failure rate` : undefined,
    },
    {
      label: "Skipped",
      value: campaign.skippedCount,
      info: "Contacts that opted out between campaign creation and send are skipped automatically.",
    },
  ]

  // Money tiles are separate from the delivery ones, and only appear once a
  // sale has actually been reported: revenue can only reach us if the customer's
  // store or CRM posts it, so an empty revenue tile would look like a
  // measurement failure rather than an integration nobody has set up.
  const revenue = analytics?.revenue
  const moneyTiles: { label: string; value: string; sub?: string; info?: string }[] =
    revenue && revenue.conversions > 0
      ? [
          {
            label: "Revenue",
            value: formatMoney(revenue.revenue, revenue.currency),
            sub: `${revenue.conversions} sale${revenue.conversions === 1 ? "" : "s"} attributed`,
            info: "Last-touch attribution inside the reporting window — the sale is credited to the click if there was one, otherwise to the send.",
          },
          {
            label: "Message cost",
            value: formatMoney(revenue.cost, revenue.currency),
            info: "What this campaign's sends actually cost when they ran, from the wallet ledger — not re-priced at today's rates.",
          },
          {
            label: "ROAS",
            // Null when nothing was charged — there's no return to compute, and
            // showing 0 would rank a free campaign below a profitable one.
            value: revenue.roas != null ? `${revenue.roas}×` : "—",
            sub: revenue.roas != null ? "revenue per unit of message cost" : "nothing was charged",
          },
        ]
      : []

  // Interpretation only where the backend gave us real rates — the local
  // `pct()` fallback above is a display convenience, not the same measurement,
  // and scoring it against a benchmark would overstate what we know.
  const interpretedRates = rates

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/campaigns")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to campaigns
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">{campaign.name}</h2>
            <CampaignStatusBadge status={campaign.status} deferredReason={campaign.deferredReason} />
          </div>
          <div className="flex items-center gap-2">
            {canPauseCampaign(campaign.status) && (
              <Button variant="outline" disabled={isPausing} onClick={() => handlePauseResume("pause")}>
                {isPausing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PauseCircle className="mr-2 h-4 w-4" />
                )}
                Pause
              </Button>
            )}
            {canResumeCampaign(campaign.status) && (
              <Button disabled={isPausing} onClick={() => handlePauseResume("resume")}>
                {isPausing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                Resume
              </Button>
            )}
          {canCancelCampaign(campaign.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isCancelling}>
                  {isCancelling ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Cancel Campaign
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel "{campaign.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Pending recipients will be skipped. Messages already sent are unaffected. This can't be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep campaign</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel}>Cancel campaign</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <Explain term="template">Template</Explain>{" "}
          <span className="font-medium text-foreground">{campaign.templateName}</span> (
          {campaign.templateLanguage}) —{" "}
          {campaign.segmentId ? (
            <>
              audience <Explain term="segment">segment</Explain>{" "}
              <Link href={`/dashboard/segments/${campaign.segmentId}`}>
                <Badge variant="outline" className="hover:bg-accent cursor-pointer">
                  {audienceSegment?.name || "View segment"}
                </Badge>
              </Link>
            </>
          ) : campaign.audienceTag ? (
            <>
              audience tag <Badge variant="outline">{campaign.audienceTag}</Badge>
            </>
          ) : (
            "all opted-in contacts"
          )}
          {campaign.scheduledAt ? ` — scheduled for ${formatDateTime(campaign.scheduledAt)}` : ""}
          {campaign.startedAt ? ` — started ${formatDateTime(campaign.startedAt)}` : ""}
          {campaign.completedAt ? ` — completed ${formatDateTime(campaign.completedAt)}` : ""}
        </p>
      </div>

      {/* Why the counters below have stopped moving. Self-hiding. */}
      <CampaignDeferredBanner campaign={campaign} />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {stats.map((s) => (
          <Card
            key={s.label}
            className={s.onClick ? "cursor-pointer transition-colors hover:bg-accent/50" : undefined}
            onClick={s.onClick}
            title={s.onClick ? "Show replied recipients" : undefined}
          >
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {s.label}
                {s.info && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{s.info}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </p>
              <p className="text-2xl font-bold">{s.value}</p>
              {s.sub && <p className="text-xs text-muted-foreground">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {moneyTiles.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {moneyTiles.map((tile) => (
            <Card key={tile.label}>
              <CardContent className="p-4">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {tile.label}
                  {tile.info && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{tile.info}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </p>
                <p className="text-2xl font-bold">{tile.value}</p>
                {tile.sub && <p className="text-xs text-muted-foreground">{tile.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RateInterpretation rates={interpretedRates} sentCount={campaign.sentCount} />

      {/* Sent → delivered → read funnel */}
      {campaign.totalRecipients > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            {[
              { label: "Sent", value: campaign.sentCount, className: "bg-info" },
              { label: "Delivered", value: campaign.deliveredCount, className: "bg-success" },
              { label: "Read", value: campaign.readCount, className: "bg-success" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-20 text-xs text-muted-foreground">{row.label}</span>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${row.className}`}
                    style={{ width: `${pct(row.value, campaign.totalRecipients)}%` }}
                  />
                </div>
                <span className="w-24 text-right text-xs text-muted-foreground">
                  {row.value} ({pct(row.value, campaign.totalRecipients)}%)
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Delivery Timeline</CardTitle>
              <CardDescription>Sent, delivered, read and replied over time.</CardDescription>
            </div>
            <Tabs
              value={chartInterval ?? "day"}
              onValueChange={(v) => setChartInterval(v as "hour" | "day")}
            >
              <TabsList>
                <TabsTrigger value="hour">Hour</TabsTrigger>
                <TabsTrigger value="day">Day</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <CampaignTimelineChart
            timeline={analytics?.timeline || []}
            interval={analytics?.interval || chartInterval || "day"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
          <CardDescription>Per-contact delivery status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={statusTab}
            onValueChange={(v) => {
              setStatusTab(v as StatusTab)
              setOffset(0)
            }}
          >
            <TabsList>
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Read</TableHead>
                  {campaign.trackLinks && <TableHead>Clicked</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={campaign.trackLinks ? 8 : 7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      ) : (
                        "No recipients in this status."
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  recipients.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.contactName || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">+{r.waId}</TableCell>
                      <TableCell>
                        <RecipientStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="max-w-64">
                        {!r.error ? (
                          <span className="text-muted-foreground">—</span>
                        ) : r.status === "skipped" ? (
                          // Skip reasons (e.g. "Contact opted out before send") matter
                          // to marketers — show them inline, not behind a tooltip.
                          <span className="block text-sm text-muted-foreground">{r.error}</span>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate text-sm text-destructive cursor-help">
                                  {r.error}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm whitespace-pre-wrap">
                                {r.error}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(r.sentAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(r.deliveredAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(r.readAt)}
                      </TableCell>
                      {campaign.trackLinks && (
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDateTime(r.clickedAt)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {recipientsTotal > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {from}–{to} of {recipientsTotal}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= recipientsTotal}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
