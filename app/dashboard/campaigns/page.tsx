"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  Eye,
  Loader2,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Plus,
  X,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { InsightBanner } from "@/components/insight-banner"
import { campaignsInsight } from "@/lib/insights"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
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
  listCampaigns,
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

const POLL_INTERVAL_MS = 5000

const STATUS_FILTERS = ["scheduled", "running", "paused", "completed", "cancelled"] as const

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
  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [pausingId, setPausingId] = useState<string | null>(null)
  const [flaggedNumber, setFlaggedNumber] = useState<{ id: string; label: string } | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [segments, setSegments] = useState<Segment[]>([])

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
        setContext(ctx)
      } catch (err) {
        console.error("Failed to resolve WhatsApp context:", err)
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const fetchCampaigns = useCallback(
    async (showSpinner = false) => {
      if (!context) return
      if (showSpinner) setIsLoading(true)
      try {
        const res = await listCampaigns(context.accountId)
        setCampaigns(Array.isArray(res) ? res : [])
      } catch (err) {
        if (showSpinner) toast.error(getErrorMessage(err) || "Failed to load campaigns")
      } finally {
        if (showSpinner) setIsLoading(false)
      }
    },
    [context]
  )

  useEffect(() => {
    fetchCampaigns(true)
  }, [fetchCampaigns])

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
      .catch(() => {})
  }, [context])

  // Segment names for audience chips; also auto-open the wizard when arriving
  // via "Create campaign from this segment".
  useEffect(() => {
    if (!context) return
    listSegments(context.accountId)
      .then((res) => {
        setSegments(Array.isArray(res) ? res : [])
      })
      .catch(() => {})
  }, [context])

  useEffect(() => {
    if ((segmentParam || newParam) && context) setShowWizard(true)
  }, [segmentParam, newParam, context])

  const segmentName = (id: string) => segments.find((s) => s.id === id)?.name || "Segment"

  const dismissBanner = () => {
    setBannerDismissed(true)
    if (flaggedNumber && typeof window !== "undefined") {
      sessionStorage.setItem(`quality-banner-dismissed:${flaggedNumber.id}`, "1")
    }
  }

  // Poll every 5s while any campaign is scheduled/running; silent refresh so
  // the table doesn't flicker.
  const hasActive = campaigns.some((c) => isCampaignActive(c.status))
  const hasActiveRef = useRef(hasActive)
  hasActiveRef.current = hasActive

  useEffect(() => {
    if (!context || !hasActive) return
    const timer = setInterval(() => {
      if (hasActiveRef.current) fetchCampaigns(false)
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [context, hasActive, fetchCampaigns])

  const handleCancel = async (campaign: Campaign) => {
    if (!context) return
    setCancellingId(campaign.id)
    try {
      await cancelCampaign(campaign.id, context.accountId)
      toast.success("Campaign cancelled")
      fetchCampaigns(false)
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
      fetchCampaigns(false)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to update campaign")
    } finally {
      setPausingId(null)
    }
  }

  const formatDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—")

  const visibleCampaigns = statusFilter ? campaigns.filter((c) => c.status === statusFilter) : campaigns

  // Reads every campaign, not the filtered view: what the last completed send
  // did is worth knowing while looking at the scheduled ones.
  const insight = useMemo(() => campaignsInsight({ campaigns }), [campaigns])

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
      cell: (campaign) =>
        campaign.segmentId ? (
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
      sortValue: (c) => c.templateName,
      cell: (campaign) => <span className="text-sm">{campaign.templateName}</span>,
    },
    {
      key: "when",
      header: "Scheduled / started",
      cardLabel: "When",
      className: "whitespace-nowrap hide-on-md",
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
      cell: (campaign) => (
        <div className="w-28 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-slow ease-out-soft"
              style={{ width: `${progressPct(campaign)}%` }}
            />
          </div>
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {campaign.sentCount}/{campaign.totalRecipients}
          </p>
        </div>
      ),
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
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      card: "actions",
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
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Broadcast template messages to your opted-in contacts."
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

      <Card>
        <CardHeader>
          <CardTitle>All campaigns</CardTitle>
          <CardDescription className="flex items-center gap-2">
            Newest first. Live campaigns refresh automatically.
            {statusFilter && (
              <Badge variant="outline" className="gap-1">
                {statusFilter}
                <button
                  onClick={() => router.push("/dashboard/campaigns")}
                  aria-label="Clear status filter"
                  className="hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </CardDescription>
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
              hint="Broadcasts go out as approved templates, and each one is charged per message — you'll see the cost before anything sends."
            />
          ) : (
            <DataTable
              columns={columns}
              rows={visibleCampaigns}
              getRowKey={(campaign) => campaign.id}
              isLoading={isLoading}
              skeletonRows={6}
              onRowClick={(campaign) => router.push(`/dashboard/campaigns/${campaign.id}`)}
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

      {context && (
        <NewCampaignDialog
          open={showWizard}
          onOpenChange={(open) => {
            setShowWizard(open)
            // Drop the deep-link param once the wizard closes so reopening
            // doesn't re-preselect the segment.
            if (!open && (segmentParam || newParam)) router.replace("/dashboard/campaigns")
          }}
          context={context}
          onCreated={() => fetchCampaigns(true)}
          initialSegmentId={segmentParam ?? undefined}
        />
      )}
    </div>
  )
}
