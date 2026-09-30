"use client"

import { swallow } from "@/lib/observability"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { formatDateTime } from "@/lib/format-date"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  Eye,
  Loader2,
  Megaphone,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  X,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { StarterLibrary } from "@/components/starter-library"
import { CAMPAIGN_STARTERS, getCampaignStarter } from "@/lib/campaign-starters"
import { InsightBanner } from "@/components/insight-banner"
import { Explain } from "@/components/explain"
import { campaignsInsight } from "@/lib/insights"
import { useCampaigns } from "@/hooks/use-queries"
import { reportSilent } from "@/lib/observability"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
import { MetricCard, MetricRow } from "@/components/metric-card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { DeliveryBar } from "./delivery-bar"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
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
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  listSegments,
  listWhatsappPhoneNumbers,
  cancelCampaign,
  pauseCampaign,
  resumeCampaign,
  type Campaign,
  type Segment,
  type WhatsappContext,
} from "@/services/api"
import { isFlaggedQuality } from "@/components/quality-badge"
import {
  CampaignStatusBadge,
  canCancelCampaign,
  canPauseCampaign,
  canResumeCampaign,
  isCampaignActive,
} from "./campaign-badges"
import { NewCampaignDialog } from "./new-campaign-dialog"
import { RepeatingBroadcasts } from "./repeating-broadcasts"
import { FOLLOW_UP_FILTER_LABELS } from "@/lib/campaign-prefill"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/hooks/use-queries"

const STATUS_FILTERS = ["scheduled", "running", "paused", "completed", "cancelled"] as const

const STATUS_TILE: Record<Campaign["status"], string> = {
  running: "bg-primary-soft text-primary",
  scheduled: "bg-info-soft text-info",
  paused: "bg-warning-soft text-warning",
  completed: "bg-success-soft text-success",
  cancelled: "bg-muted text-muted-foreground",
}

export default function CampaignsPage() {
  return (
    <Suspense>
      <CampaignsPageInner />
    </Suspense>
  )
}

function CampaignsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusParam = searchParams.get("status")
  const statusFilter = (STATUS_FILTERS as readonly string[]).includes(statusParam || "")
    ? (statusParam as Campaign["status"])
    : null
  // "Create campaign from this segment" deep link
  const segmentParam = searchParams.get("segment")
  // ?new=1 — deep link behind the command palette's "Send a broadcast".
  const newParam = searchParams.get("new")
  // ?starter=<id> — goal-shaped entry from the starter library below.
  const starter = getCampaignStarter(searchParams.get("starter"))
  const [context, setContext] = useState<WhatsappContext | null>(null)
  // Polls itself while anything is scheduled or running, and stops when nothing
  // is — the predicate is evaluated against each result inside the hook.
  const { data, isLoading, error, refetch } = useCampaigns(context?.accountId, {
    pollWhile: (rows) => rows.some((c) => isCampaignActive(c.status)),
  })
  const campaigns: Campaign[] = useMemo(() => (Array.isArray(data) ? data : []), [data])
  const loadError = error ? getErrorMessage(error, "Failed to load campaigns") : null
  const [showWizard, setShowWizard] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [pausingId, setPausingId] = useState<string | null>(null)
  // The phone list's Cancel lives in a menu, which closes before a confirm
  // could open inside it, so the confirm is one dialog at page level.
  const [cancelTarget, setCancelTarget] = useState<Campaign | null>(null)
  const [flaggedNumber, setFlaggedNumber] = useState<{ id: string; label: string } | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [segments, setSegments] = useState<Segment[]>([])

  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) return
      try {
        setContext(await getActiveWhatsappContext())
      } catch (err) {
        reportSilent(err, { source: "app/dashboard/campaigns/page.tsx", step: "resolve-context" })
      }
    }
    init()
  }, [])

  const queryClient = useQueryClient()
  // A repeating broadcast adds to the series list, not (yet) the campaigns.
  const fetchCampaigns = useCallback(() => {
    refetch()
    if (context?.accountId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaignSeries(context.accountId) })
    }
  }, [refetch, queryClient, context?.accountId])

  // Warn when Meta has flagged any of the account's numbers — sending more
  // marketing volume on a flagged number risks restriction.
  useEffect(() => {
    if (!context) return
    listWhatsappPhoneNumbers(context.accountId)
      .then((numbers) => {
        const flagged = (numbers || []).find((n) => isFlaggedQuality(n.qualityRating))
        if (!flagged) return
        const id = flagged.phoneNumberId || flagged.id
        setFlaggedNumber({
          id,
          label: flagged.displayPhoneNumber || flagged.verifiedName || id,
        })
        setBannerDismissed(
          typeof window !== "undefined" && sessionStorage.getItem(`quality-banner-dismissed:${id}`) === "1"
        )
      })
      .catch(swallow("app/dashboard/campaigns/page.tsx"))
  }, [context])

  // Segment names for audience chips; also auto-open the wizard when arriving
  // via "Create campaign from this segment".
  useEffect(() => {
    if (!context) return
    listSegments(context.accountId)
      .then((res) => {
        setSegments(Array.isArray(res) ? res : [])
      })
      .catch(swallow("app/dashboard/campaigns/page.tsx"))
  }, [context])

  useEffect(() => {
    if ((segmentParam || newParam || starter) && context) setShowWizard(true)
  }, [segmentParam, newParam, starter, context])

  const segmentName = (id: string) => segments.find((s) => s.id === id)?.name || "Segment"

  const dismissBanner = () => {
    setBannerDismissed(true)
    if (flaggedNumber && typeof window !== "undefined") {
      sessionStorage.setItem(`quality-banner-dismissed:${flaggedNumber.id}`, "1")
    }
  }


  const handleCancel = async (campaign: Campaign) => {
    if (!context) return
    setCancellingId(campaign.id)
    try {
      await cancelCampaign(campaign.id, context.accountId)
      toast.success("Campaign cancelled")
      fetchCampaigns()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to cancel campaign")
    } finally {
      setCancellingId(null)
    }
  }

  const handlePauseResume = async (campaign: Campaign) => {
    if (!context) return
    setPausingId(campaign.id)
    try {
      if (campaign.status === "paused") {
        const updated = await resumeCampaign(campaign.id, context.accountId)
        toast.success(`Campaign ${updated.status}`)
      } else {
        await pauseCampaign(campaign.id, context.accountId)
        toast.success("Campaign paused")
      }
      fetchCampaigns()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to update campaign")
    } finally {
      setPausingId(null)
    }
  }

  // Shared formatter: see lib/format-date.ts

  const visibleCampaigns = statusFilter ? campaigns.filter((c) => c.status === statusFilter) : campaigns

  // Reads every campaign, not the filtered view: what the last completed send
  // did is worth knowing while looking at the scheduled ones.
  const insight = useMemo(() => campaignsInsight({ campaigns }), [campaigns])

  // Account-wide, not the filtered view: the strip is the account's story.
  const summary = useMemo(() => {
    const sent = campaigns.reduce((n, c) => n + c.sentCount, 0)
    const read = campaigns.reduce((n, c) => n + c.readCount, 0)
    const running = campaigns.filter((c) => c.status === "running").length
    const scheduled = campaigns.filter((c) => c.status === "scheduled").length
    return {
      total: campaigns.length,
      completed: campaigns.filter((c) => c.status === "completed").length,
      sent,
      readRate: sent > 0 ? Math.round((read / sent) * 100) : null,
      running,
      scheduled,
    }
  }, [campaigns])
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of campaigns) counts[c.status] = (counts[c.status] ?? 0) + 1
    return counts
  }, [campaigns])

  const readRate = (c: Campaign) => (c.sentCount > 0 ? Math.round((c.readCount / c.sentCount) * 100) : null)

  const progressPct = (c: Campaign) =>
    c.totalRecipients > 0 ? Math.min(100, Math.round((c.sentCount / c.totalRecipients) * 100)) : 0

  // One definition drives both the desktop table and the phone card list.
  const columns: Column<Campaign>[] = [
    {
      key: "name",
      header: "Name",
      card: "title",
      sortValue: (c) => c.name,
      cell: (campaign) => <span className="font-medium">{campaign.name}</span>,
    },
    {
      key: "status",
      header: "Status",
      card: "meta",
      sortValue: (c) => c.status,
      cell: (campaign) => (
        <CampaignStatusBadge status={campaign.status} deferredReason={campaign.deferredReason} />
      ),
    },
    {
      key: "audience",
      header: "Audience",
      className: "hide-on-lg",
      card: "hidden",
      cell: (campaign) =>
        // A follow-up's audience came from an earlier campaign, not "everyone".
        campaign.followUpCampaignId && campaign.followUpFilter ? (
          <span className="text-sm">
            Follow-up
            <span className="block text-xs text-muted-foreground">
              {FOLLOW_UP_FILTER_LABELS[campaign.followUpFilter]}
            </span>
          </span>
        ) : campaign.segmentId ? (
          <Badge variant="outline">{segmentName(campaign.segmentId)}</Badge>
        ) : campaign.audienceTag ? (
          <Badge variant="outline">{campaign.audienceTag}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">All opted-in</span>
        ),
    },
    {
      key: "template",
      header: "Template",
      className: "hide-on-lg",
      card: "hidden",
      sortValue: (c) => c.templateName,
      cell: (campaign) => <span className="text-sm">{campaign.templateName}</span>,
    },
    {
      key: "when",
      header: "Scheduled / started",
      cardLabel: "When",
      className: "whitespace-nowrap hide-on-md",
      card: "meta",
      sortValue: (c) => c.startedAt || c.scheduledAt || c.createdAt,
      cell: (campaign) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(campaign.startedAt || campaign.scheduledAt)}
        </span>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      sortValue: (c) => progressPct(c),
      cell: (campaign) => <DeliveryBar campaign={campaign} className="w-28" />,
      cardCell: (campaign) => <DeliveryBar campaign={campaign} className="w-40" />,
    },
    {
      key: "readRate",
      header: "Read rate",
      sortValue: (c) => readRate(c),
      className: "hide-on-md",
      cell: (campaign) => (
        <span className="font-mono text-sm tabular-nums">
          {readRate(campaign) != null ? `${readRate(campaign)}%` : "—"}
        </span>
      ),
      cardCell: (campaign) =>
        readRate(campaign) != null ? (
          <span className="text-xs text-muted-foreground">{readRate(campaign)}% read</span>
        ) : null,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      // On a phone the row opens the campaign; the rest is in "menu" below.
      card: "hidden",
      cell: (campaign) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" title="View" asChild>
            <Link href={`/dashboard/campaigns/${campaign.id}`}>
              <Eye className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {(canPauseCampaign(campaign.status) || canResumeCampaign(campaign.status)) && (
            <Button
              variant="ghost"
              size="sm"
              title={canResumeCampaign(campaign.status) ? "Resume campaign" : "Pause campaign"}
              disabled={pausingId === campaign.id}
              onClick={() => handlePauseResume(campaign)}
            >
              {pausingId === campaign.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : canResumeCampaign(campaign.status) ? (
                <PlayCircle className="h-3.5 w-3.5" />
              ) : (
                <PauseCircle className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          {canCancelCampaign(campaign.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Cancel campaign"
                  disabled={cancellingId === campaign.id}
                  className="text-destructive hover:text-destructive"
                >
                  {cancellingId === campaign.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel "{campaign.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Pending recipients will be skipped. Messages already sent are unaffected. This
                    can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep campaign</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleCancel(campaign)}>
                    Cancel campaign
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      ),
    },
    {
      key: "menu",
      header: "",
      // Phone list only; the table has the "actions" column above.
      className: "hidden",
      card: "actions",
      cell: (campaign) => {
        const canToggle = canPauseCampaign(campaign.status) || canResumeCampaign(campaign.status)
        const canCancel = canCancelCampaign(campaign.status)
        const busy = pausingId === campaign.id || cancellingId === campaign.id
        if (!canToggle && !canCancel) return null
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${campaign.name}`} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canToggle && (
                <DropdownMenuItem onSelect={() => handlePauseResume(campaign)}>
                  {canResumeCampaign(campaign.status) ? (
                    <PlayCircle className="mr-2 h-4 w-4" />
                  ) : (
                    <PauseCircle className="mr-2 h-4 w-4" />
                  )}
                  {canResumeCampaign(campaign.status) ? "Resume" : "Pause"}
                </DropdownMenuItem>
              )}
              {canToggle && canCancel && <DropdownMenuSeparator />}
              {canCancel && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setCancelTarget(campaign)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel campaign
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description={
          <>
            Broadcast <Explain term="template">template messages</Explain> to your{" "}
            <Explain term="opt-in">opted-in</Explain> contacts.
          </>
        }
        actions={
          <Button onClick={() => setShowWizard(true)} disabled={!context}>
            <Plus className="mr-2 h-4 w-4" /> New Campaign
          </Button>
        }
      />

      {flaggedNumber && !bannerDismissed && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/25 bg-destructive-soft p-4 text-destructive ">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="flex-1 text-sm">
            Your number <span className="font-semibold">{flaggedNumber.label}</span> is flagged by Meta —
            sending more marketing messages may get it restricted.
          </p>
          <button onClick={dismissBanner} aria-label="Dismiss warning" className="shrink-0 hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Below the flagged-number banner on purpose: a restricted number is a
          harder problem than anything a suggestion can be about. */}
      <InsightBanner insight={insight} />

      {campaigns.length > 0 && (
        <MetricRow>
          <MetricCard
            label="Campaigns"
            value={summary.total}
            read={`${summary.completed} completed`}
            icon={Megaphone}
            featured
            index={0}
          />
          <MetricCard label="Messages sent" value={summary.sent} read="Across every campaign" index={1} />
          <MetricCard
            label="Read rate"
            value={summary.readRate ?? 0}
            display={summary.readRate == null ? "—" : undefined}
            suffix={summary.readRate == null ? undefined : "%"}
            read="Of everything sent"
            index={2}
          />
          <MetricCard
            label="Live now"
            value={summary.running + summary.scheduled}
            read={`${summary.running} running · ${summary.scheduled} scheduled`}
            live={summary.running > 0}
            index={3}
          />
        </MetricRow>
      )}

      {/* Above the list, not instead of it — an established account still
          reaches its own campaigns first. A starter names the send as an
          outcome and fills in the name and audience; the template stays a
          choice, because only Meta-approved ones can be broadcast. */}
      <StarterLibrary
        title="Start with a goal"
        description="The sends most businesses make. Each one fills in the audience — you pick the message."
        basePath="/dashboard/campaigns"
        options={CAMPAIGN_STARTERS}
        disabled={!context}
        disabledReason={context ? undefined : "Connect a WhatsApp number first."}
      />

      {/* Renders nothing until the account has a repeating broadcast. */}
      {context && <RepeatingBroadcasts accountId={context.accountId} />}

      <Card>
        <CardHeader>
          <CardTitle>All campaigns</CardTitle>
          <CardDescription>Newest first. Live campaigns refresh automatically.</CardDescription>
          {campaigns.length > 0 && (
            // The filter was a URL parameter with no control on the page;
            // chips make every state one tap away, with its count.
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pt-3 pb-1">
              {([null, ...STATUS_FILTERS] as const).map((status) => {
                const active = statusFilter === status
                const count = status ? (statusCounts[status] ?? 0) : campaigns.length
                if (status && count === 0 && !active) return null
                return (
                  <button
                    key={status ?? "all"}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      router.push(status ? `/dashboard/campaigns?status=${status}` : "/dashboard/campaigns")
                    }
                    className={cn(
                      "focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors duration-fast ease-out-soft",
                      active
                        ? "border-primary/40 bg-primary-soft text-primary-emphasis"
                        : "border-border-subtle text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {status ?? "All"}
                    <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!isLoading && context && campaigns.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description="Create your first broadcast to reach your opted-in contacts."
              action={
                <Button onClick={() => setShowWizard(true)}>
                  <Plus className="mr-2 h-4 w-4" /> New campaign
                </Button>
              }
              hint={
                <>
                  Broadcasts go out as approved <Explain term="template">templates</Explain>, and
                  each one is charged per message — you&apos;ll see the cost before anything sends.
                </>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              rows={visibleCampaigns}
              getRowKey={(campaign) => campaign.id}
              isLoading={isLoading}
              skeletonRows={6}
              onRowClick={(campaign) => router.push(`/dashboard/campaigns/${campaign.id}`)}
              mobileLayout="list"
              mobileLeading={(campaign) => (
                <span
                  aria-hidden
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl",
                    STATUS_TILE[campaign.status],
                  )}
                >
                  <Megaphone className={cn("h-4 w-4", campaign.status === "running" && "animate-pulse")} />
                </span>
              )}
              error={
                loadError ? (
                  <EmptyState
                    plain
                    icon={Megaphone}
                    title="Couldn't load your campaigns"
                    description={`${loadError}. A running broadcast keeps sending — this is a problem reading the list, not sending from it.`}
                    action={
                      <Button variant="outline" onClick={() => refetch()}>
                        Try again
                      </Button>
                    }
                  />
                ) : undefined
              }
              empty={
                !context ? (
                  <EmptyState
                    plain
                    icon={Megaphone}
                    title="No registered WhatsApp number yet"
                    description="Finish the WhatsApp setup flow before sending a broadcast."
                    action={
                      <Button asChild>
                        <Link href="/dashboard/whatsapp">Go to WhatsApp setup</Link>
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    plain
                    icon={Megaphone}
                    title={`No ${statusFilter} campaigns`}
                    description="Nothing in this state right now."
                    action={
                      <Button variant="outline" onClick={() => router.push("/dashboard/campaigns")}>
                        Show all campaigns
                      </Button>
                    }
                  />
                )
              }
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel &quot;{cancelTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Pending recipients will be skipped. Messages already sent are unaffected. This can&apos;t
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep campaign</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelTarget) handleCancel(cancelTarget)
                setCancelTarget(null)
              }}
            >
              Cancel campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {context && (
        <NewCampaignDialog
          open={showWizard}
          onOpenChange={(open) => {
            setShowWizard(open)
            // Drop the deep-link param once the wizard closes so reopening
            // doesn't re-preselect the segment.
            if (!open && (segmentParam || newParam || starter)) {
              router.replace("/dashboard/campaigns")
            }
          }}
          context={context}
          onCreated={() => fetchCampaigns()}
          initialSegmentId={segmentParam ?? undefined}
          starter={starter}
        />
      )}
    </div>
  )
}
