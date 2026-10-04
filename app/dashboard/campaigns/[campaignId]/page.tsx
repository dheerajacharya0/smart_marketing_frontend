"use client"

import { reportSilent, swallow } from "@/lib/observability"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { getErrorMessage } from "@/lib/errors"
import { formatDateTime } from "@/lib/format-date"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Loader2,
  PauseCircle,
  PlayCircle,
  Reply,
  Send,
  Users,
  XCircle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { MetricCard, MetricRow } from "@/components/metric-card"
import { DataTable, type Column } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
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
  getSegment,
  cancelCampaign,
  pauseCampaign,
  resumeCampaign,
  type CampaignRecipient,
  type CampaignRecipientStatus,
  type Segment,
  type WhatsappContext,
} from "@/services/api"
import { NewCampaignDialog } from "../new-campaign-dialog"
import {
  duplicatePrefill,
  FOLLOW_UP_FILTER_LABELS,
  FOLLOW_UP_FILTER_ORDER,
  followUpCounts,
  followUpPrefill,
  type CampaignPrefill,
} from "@/lib/campaign-prefill"
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
import { useCampaign, useCampaignAnalytics, useCampaignRecipients } from "@/hooks/use-queries"
import { Explain } from "@/components/explain"
import { formatMoney } from "@/lib/money"
import { describeStoredRules } from "@/lib/audience-tags"
import { CampaignTimelineChart } from "./campaign-timeline-chart"
import { BroadcastLoader } from "@/components/broadcast-loader"

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
  // The sending number, for Duplicate and Follow up. Null until resolved, and
  // for an account with no registered number — then those actions stay off.
  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [prefill, setPrefill] = useState<CampaignPrefill | null>(null)
  // null = not yet resolved; defaults to hour for campaigns started <48h ago
  const [chartInterval, setChartInterval] = useState<"hour" | "day" | null>(null)
  const [statusTab, setStatusTab] = useState<StatusTab>("all")
  const [offset, setOffset] = useState(0)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isPausing, setIsPausing] = useState(false)
  const [audienceSegment, setAudienceSegment] = useState<Segment | null>(null)

  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) return
      try {
        const ctx = await getActiveWhatsappContext()
        if (ctx) {
          setAccountId(ctx.accountId)
          setContext(ctx)
        }
      } catch (err) {
        reportSilent(err, {
          source: "app/dashboard/campaigns/[campaignId]/page.tsx",
          step: "resolve-account",
        })
      }
    }
    init()
  }, [])

  // Three reads that used to be one Promise.all. Split because they fail
  // separately and always did — the analytics call carried a `.catch(() => null)`
  // so a missing analytics block wouldn't take the campaign down with it, and
  // the recipients page is refetched on every tab and page change while the
  // campaign itself is not.
  const {
    data: campaign,
    isLoading: campaignLoading,
    error: campaignError,
    refetch: refetchCampaign,
  } = useCampaign(accountId, campaignId, {
    pollWhile: (row) => isCampaignActive(row?.status),
  })
  // A follow-up's audience is "people from that campaign who…", so the page
  // names that campaign. Null id disables the query for everything else.
  const { data: followedCampaignRow } = useCampaign(accountId, campaign?.followUpCampaignId)

  // The recipients tab is a filter on a live send, so it follows the campaign's
  // own polling: while it is running, the counts move.
  const active = isCampaignActive(campaign?.status)
  const pollMs = active ? POLL_INTERVAL_MS : false

  const { data: analytics, refetch: refetchAnalytics } = useCampaignAnalytics(
    accountId,
    campaignId,
    chartInterval,
    { refetchIntervalMs: pollMs },
  )

  // "Replied" is a timestamp, not a recipient status the backend can filter on,
  // so that tab fetches a capped window and pages it here.
  const repliedTab = statusTab === "replied"
  const { data: recipientsPage, refetch: refetchRecipients } = useCampaignRecipients(
    accountId,
    campaignId,
    repliedTab
      ? { limit: REPLIED_FETCH_LIMIT, offset: 0 }
      : {
          ...(statusTab === "all" ? {} : { status: statusTab }),
          limit: PAGE_SIZE,
          offset,
        },
    { refetchIntervalMs: pollMs },
  )

  const { recipients, recipientsTotal } = useMemo(() => {
    const items: CampaignRecipient[] = Array.isArray(recipientsPage?.items)
      ? recipientsPage.items
      : []
    if (!repliedTab) return { recipients: items, recipientsTotal: recipientsPage?.total ?? 0 }
    const replied = items.filter((r) => r.repliedAt)
    return {
      recipients: replied.slice(offset, offset + PAGE_SIZE),
      recipientsTotal: replied.length,
    }
  }, [recipientsPage, repliedTab, offset])

  const isLoading = campaignLoading
  const loadError = campaignError
    ? getErrorMessage(campaignError, "Failed to load campaign")
    : null

  const fetchAll = useCallback(() => {
    refetchCampaign()
    refetchAnalytics()
    refetchRecipients()
  }, [refetchCampaign, refetchAnalytics, refetchRecipients])

  // The segment name behind the audience chip. Declared after the campaign
  // query because it reads `campaign.segmentId` — it used to sit above it, back
  // when `campaign` was a `useState` that hoisted.
  useEffect(() => {
    if (!accountId || !campaign?.segmentId) return
    getSegment(campaign.segmentId, accountId)
      .then((res) => setAudienceSegment(res))
      .catch(swallow("app/dashboard/campaigns/[campaignId]/page.tsx"))
  }, [accountId, campaign?.segmentId])

  // Default the timeline to hourly buckets for campaigns started <48h ago.
  useEffect(() => {
    if (!campaign || chartInterval !== null) return
    const startedRecently =
      !!campaign.startedAt && Date.now() - new Date(campaign.startedAt).getTime() < 48 * 60 * 60 * 1000
    setChartInterval(startedRecently ? "hour" : "day")
  }, [campaign, chartInterval])

  const handleCancel = async () => {
    if (!accountId || !campaign) return
    setIsCancelling(true)
    try {
      await cancelCampaign(campaign.id, accountId)
      toast.success("Campaign cancelled")
      fetchAll()
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
      fetchAll()
    } catch (err) {
      toast.error(getErrorMessage(err) || `Failed to ${action} campaign`)
    } finally {
      setIsPausing(false)
    }
  }

  // Shared formatter: see lib/format-date.ts for why this isn't a local one.

  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

  if (isLoading && !campaign) {
    return (
      <div className="flex h-64 items-center justify-center">
        <BroadcastLoader />
      </div>
    )
  }

  // A failed load is not a missing campaign. This page used to print "Campaign
  // not found." for both, which tells someone their broadcast was deleted when
  // the request merely failed — and a campaign that is mid-send keeps sending
  // either way.
  if (loadError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/campaigns")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to campaigns
        </Button>
        <p className="text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => refetchCampaign()}>
          Try again
        </Button>
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
  const deliveryRate = rates
    ? rates.deliveryRate
    : campaign.sentCount > 0
      ? pct(campaign.deliveredCount, campaign.sentCount)
      : null
  const readRate = rates
    ? rates.readRate
    : campaign.sentCount > 0
      ? pct(campaign.readCount, campaign.sentCount)
      : null

  const showReplied = () => {
    setStatusTab("replied")
    setOffset(0)
    document.getElementById("campaign-recipients")?.scrollIntoView({ behavior: "smooth" })
  }

  const counts = followUpCounts(campaign)
  const [followedCampaign, followedFilter] = [campaign.followUpCampaignId, campaign.followUpFilter]
  // Plain words for the follow-up audience: "didn't reply to “Diwali Sale”".
  const followedName = followedCampaignRow?.name ?? "an earlier campaign"
  const followUpAudience =
    followedCampaign && followedFilter
      ? {
          not_replied: `people who didn't reply to “${followedName}”`,
          not_read: `people who didn't read “${followedName}”`,
          reached: `everyone “${followedName}” reached`,
          replied: `people who replied to “${followedName}”`,
        }[followedFilter]
      : null

  // Money tiles only appear once a sale has actually been reported: revenue can
  // only reach us if the customer's store or CRM posts it, so an empty revenue
  // tile would look like a measurement failure rather than an integration
  // nobody has set up.
  const revenue = analytics?.revenue
  const hasRevenue = !!revenue && revenue.conversions > 0

  const recipientColumns: Column<CampaignRecipient>[] = [
    {
      key: "contact",
      header: "Contact",
      card: "title",
      cell: (r) => (
        <span className="font-medium">
          {r.contactName || <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      card: "meta",
      className: "whitespace-nowrap",
      cell: (r) => `+${r.waId}`,
    },
    {
      key: "status",
      header: "Status",
      card: "meta",
      cell: (r) => <RecipientStatusBadge status={r.status} />,
    },
    {
      key: "error",
      header: "Error",
      card: "body",
      className: "max-w-64",
      cell: (r) =>
        !r.error ? (
          <span className="text-muted-foreground">—</span>
        ) : r.status === "skipped" ? (
          // Skip reasons (e.g. "Contact opted out before send") matter to
          // marketers — show them inline, not behind a tooltip.
          <span className="block text-sm text-muted-foreground">{r.error}</span>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block truncate text-sm text-destructive cursor-help">{r.error}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm whitespace-pre-wrap">{r.error}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
    },
    ...(
      [
        ["sent", "Sent", (r: CampaignRecipient) => r.sentAt],
        ["delivered", "Delivered", (r: CampaignRecipient) => r.deliveredAt],
        ["read", "Read", (r: CampaignRecipient) => r.readAt],
        ...(campaign.trackLinks
          ? ([["clicked", "Clicked", (r: CampaignRecipient) => r.clickedAt]] as const)
          : []),
      ] as const
    ).map(
      ([key, header, at]): Column<CampaignRecipient> => ({
        key,
        header,
        card: "body",
        className: "whitespace-nowrap text-sm text-muted-foreground",
        cell: (r) => formatDateTime(at(r)),
      })
    ),
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/campaigns">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to campaigns
          </Link>
        </Button>
        <PageHeader
          eyebrow="Campaign"
          title={campaign.name}
          description={`${campaign.templateName} (${campaign.templateLanguage}) to ${
            followUpAudience ??
            (campaign.segmentId
              ? `segment ${audienceSegment?.name ?? ""}`.trim()
              : campaign.audienceRules
                ? `contacts tagged ${describeStoredRules(campaign.audienceRules)}`
                : campaign.audienceTag
                  ? `contacts tagged ${campaign.audienceTag}`
                  : "all contacts")
          }`}
          actions={
            <>
              <CampaignStatusBadge status={campaign.status} deferredReason={campaign.deferredReason} />
              {/* A follow-up needs people the campaign reached; before the
                  first send there is nobody to follow up. */}
              {campaign.sentCount > 0 && (
                // Non-modal: a modal menu that opens a dialog leaves the page
                // ignoring the next click once that dialog closes (Radix).
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button disabled={!context}>
                      <Reply className="mr-2 h-4 w-4" /> Follow up <ChevronDown className="ml-1 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      Send a new message to people from this campaign who…
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {FOLLOW_UP_FILTER_ORDER.map((filter) => (
                      <DropdownMenuItem
                        key={filter}
                        disabled={counts[filter] === 0}
                        onSelect={() => setPrefill(followUpPrefill(campaign, filter))}
                        className="justify-between"
                      >
                        <span>{FOLLOW_UP_FILTER_LABELS[filter]}</span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          ~{counts[filter]}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                variant="outline"
                disabled={!context}
                onClick={() => setPrefill(duplicatePrefill(campaign, new Date(), followedCampaignRow?.name))}
              >
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </Button>
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
                      <AlertDialogTitle>Cancel &quot;{campaign.name}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Pending recipients will be skipped. Messages already sent are unaffected. This
                        can&apos;t be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep campaign</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancel}>Cancel campaign</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          }
        />
      </div>

      {/* Why the counters below have stopped moving. Self-hiding. */}
      <CampaignDeferredBanner campaign={campaign} />

      <MetricRow>
        <MetricCard
          label="Sent"
          value={campaign.sentCount}
          read={`of ${campaign.totalRecipients} recipient${campaign.totalRecipients === 1 ? "" : "s"}`}
          icon={Send}
          live={active}
          featured
          index={0}
        />
        <MetricCard
          label="Delivered"
          value={campaign.deliveredCount}
          read={deliveryRate != null ? `${deliveryRate}% of sent` : "Nothing sent yet"}
          index={1}
        />
        <MetricCard
          label="Read"
          value={campaign.readCount}
          read={readRate != null ? `${readRate}% of sent` : "Nothing sent yet"}
          index={2}
        />
        <MetricCard
          label="Replies"
          value={repliedCount}
          read={rates ? `${rates.replyRate}% reply rate · show who` : "Show who replied"}
          onClick={showReplied}
          index={3}
        />
      </MetricRow>

      {hasRevenue && (
        <MetricRow>
          <MetricCard
            label="Revenue"
            display={formatMoney(revenue.revenue, revenue.currency)}
            read={`${revenue.conversions} sale${revenue.conversions === 1 ? "" : "s"}, credited to the click if there was one, otherwise the send`}
            index={7}
          />
          <MetricCard
            label="Message cost"
            display={formatMoney(revenue.cost, revenue.currency)}
            read="What the sends cost when they ran"
            index={8}
          />
          <MetricCard
            label="ROAS"
            // Null when nothing was charged — there's no return to compute, and
            // showing 0 would rank a free campaign below a profitable one.
            display={revenue.roas != null ? `${revenue.roas}×` : "—"}
            read={revenue.roas != null ? "Revenue per unit of message cost" : "Nothing was charged"}
            index={8}
          />
        </MetricRow>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
            <CardDescription>How this campaign was set up</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <DetailRow label={<Explain term="template">Template</Explain>}>
                {campaign.templateName}{" "}
                <span className="text-muted-foreground">({campaign.templateLanguage})</span>
              </DetailRow>
              <DetailRow label="Audience">
                {followedCampaign && followedFilter ? (
                  <>
                    {FOLLOW_UP_FILTER_LABELS[followedFilter]}
                    <span className="block text-xs font-normal text-muted-foreground">
                      from{" "}
                      <Link
                        href={`/dashboard/campaigns/${followedCampaign}`}
                        className="underline underline-offset-4 hover:text-primary"
                      >
                        {followedName}
                      </Link>
                    </span>
                  </>
                ) : campaign.segmentId ? (
                  <Link href={`/dashboard/segments/${campaign.segmentId}`}>
                    <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                      {audienceSegment?.name || "View segment"}
                    </Badge>
                  </Link>
                ) : campaign.audienceRules ? (
                  <Badge variant="outline">{describeStoredRules(campaign.audienceRules)}</Badge>
                ) : campaign.audienceTag ? (
                  <Badge variant="outline">{campaign.audienceTag}</Badge>
                ) : (
                  "All contacts"
                )}
              </DetailRow>
              {campaign.seriesId && (
                <DetailRow label="Repeats">
                  <Link href="/dashboard/campaigns" className="underline underline-offset-4 hover:text-primary">
                    Part of a repeating broadcast
                  </Link>
                </DetailRow>
              )}
              <DetailRow label="Labels">
                {campaign.recipientTags?.length ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    {campaign.recipientTags.map((tag) => (
                      <Link key={tag} href={`/dashboard/contacts?tag=${encodeURIComponent(tag)}`}>
                        <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                          {tag}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </DetailRow>
              <DetailRow label="Link tracking">{campaign.trackLinks ? "On" : "Off"}</DetailRow>
              {campaign.scheduledAt && (
                <DetailRow label="Scheduled">{formatDateTime(campaign.scheduledAt)}</DetailRow>
              )}
              {campaign.startedAt && (
                <DetailRow label="Started">{formatDateTime(campaign.startedAt)}</DetailRow>
              )}
              {campaign.completedAt && (
                <DetailRow label="Completed">{formatDateTime(campaign.completedAt)}</DetailRow>
              )}
            </dl>
            {!!campaign.recipientTags?.length && (
              <p className="mt-4 text-xs text-muted-foreground">
                Each contact got these labels once their message was sent. Click one to see who has
                it, or pick it as the audience of your next campaign to follow up.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Delivery</CardTitle>
            <CardDescription>
              {campaign.totalRecipients === 1
                ? "Where the one recipient got to"
                : `Share of the ${campaign.totalRecipients} recipients at each stage`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Sent", value: campaign.sentCount, className: "bg-info" },
              { label: "Delivered", value: campaign.deliveredCount, className: "bg-success" },
              { label: "Read", value: campaign.readCount, className: "bg-success" },
              // Only for a campaign that tracked its links. On one that didn't,
              // a 0% click rate isn't a result — nobody could have been counted.
              ...(campaign.trackLinks
                ? [{ label: "Clicked", value: campaign.clickedCount ?? 0, className: "bg-primary" }]
                : []),
              { label: "Failed", value: campaign.failedCount, className: "bg-destructive" },
              { label: "Skipped", value: campaign.skippedCount, className: "bg-muted-foreground" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-20 text-xs text-muted-foreground">{row.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${row.className}`}
                    style={{ width: `${pct(row.value, campaign.totalRecipients)}%` }}
                  />
                </div>
                <span className="w-24 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {row.value} ({pct(row.value, campaign.totalRecipients)}%)
                </span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              Skipped contacts opted out between creating the campaign and the send.
              {campaign.trackLinks && " Clicks count people, not taps."} The Failed and Skipped tabs
              below show why for each contact.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interpretation only where the backend gave us real rates — the local
          `pct()` fallback above is a display convenience, not the same
          measurement, and scoring it against a benchmark would overstate what
          we know. */}
      <RateInterpretation rates={rates} sentCount={campaign.sentCount} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Delivery timeline</CardTitle>
              <CardDescription>Sent, delivered, read and replied over time</CardDescription>
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

      <Card id="campaign-recipients" className="scroll-mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recipients</CardTitle>
          <CardDescription>Per-contact delivery status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={statusTab}
            onValueChange={(v) => {
              setStatusTab(v as StatusTab)
              setOffset(0)
            }}
          >
            <TabsList className="h-auto flex-wrap">
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <DataTable
            columns={recipientColumns}
            rows={recipients}
            getRowKey={(r) => r.id}
            isLoading={!recipientsPage}
            skeletonRows={5}
            // Paged and filtered server-side: sorting here would only reorder
            // the current page.
            disableSorting
            pagination={{
              offset,
              pageSize: PAGE_SIZE,
              total: recipientsTotal,
              onOffsetChange: setOffset,
              noun: "recipient",
            }}
            empty={
              <EmptyState
                plain
                icon={Users}
                title="No recipients in this status"
                description="Pick another tab to see the rest of the audience."
              />
            }
          />
        </CardContent>
      </Card>

      {context && (
        <NewCampaignDialog
          open={!!prefill}
          onOpenChange={(open) => {
            if (!open) setPrefill(null)
          }}
          context={context}
          prefill={prefill ?? undefined}
          onCreated={(created) =>
            // A repeating broadcast has no campaign yet; its sends are listed on the campaigns page.
            router.push(created ? `/dashboard/campaigns/${created.id}` : "/dashboard/campaigns")
          }
        />
      )}
    </div>
  )
}

function DetailRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  )
}
