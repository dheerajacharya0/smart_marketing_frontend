"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Eye, Loader2, Megaphone, Plus, X, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  type Campaign,
  type Segment,
  type WhatsappContext,
} from "@/services/api"
import { isFlaggedQuality } from "@/components/quality-badge"
import { CampaignStatusBadge, isCampaignActive } from "./campaign-badges"
import { NewCampaignDialog } from "./new-campaign-dialog"

const POLL_INTERVAL_MS = 5000

const STATUS_FILTERS = ["scheduled", "running", "completed", "cancelled"] as const

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
  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
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

  // Warn when Meta has flagged any of the account's numbers â€” sending more
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
    if (segmentParam && context) setShowWizard(true)
  }, [segmentParam, context])

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

  const formatDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "â€”")

  const visibleCampaigns = statusFilter ? campaigns.filter((c) => c.status === statusFilter) : campaigns

  const readRate = (c: Campaign) => (c.sentCount > 0 ? Math.round((c.readCount / c.sentCount) * 100) : null)

  const progressPct = (c: Campaign) =>
    c.totalRecipients > 0 ? Math.min(100, Math.round((c.sentCount / c.totalRecipients) * 100)) : 0

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
        <div className="flex items-start gap-3 rounded-md border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="flex-1 text-sm">
            Your number <span className="font-semibold">{flaggedNumber.label}</span> is flagged by Meta â€”
            sending more marketing messages may get it restricted.
          </p>
          <button onClick={dismissBanner} aria-label="Dismiss warning" className="shrink-0 hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
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
            <div className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-accent p-3 mb-3">
                <Megaphone className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-medium">No campaigns yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Create your first broadcast to reach your opted-in contacts.
              </p>
              <Button onClick={() => setShowWizard(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Campaign
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Scheduled / Started</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Read rate</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                          <span className="text-sm text-muted-foreground">Loading campaigns...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : !context ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        No registered WhatsApp number yet â€” finish the WhatsApp setup flow first.
                      </TableCell>
                    </TableRow>
                  ) : visibleCampaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        No {statusFilter} campaigns.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleCampaigns.map((campaign) => (
                      <TableRow
                        key={campaign.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/dashboard/campaigns/${campaign.id}`)}
                      >
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>
                          <CampaignStatusBadge
                            status={campaign.status}
                            deferredReason={campaign.deferredReason}
                          />
                        </TableCell>
                        <TableCell>
                          {campaign.segmentId ? (
                            <Badge variant="outline">{segmentName(campaign.segmentId)}</Badge>
                          ) : campaign.audienceTag ? (
                            <Badge variant="outline">{campaign.audienceTag}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">All opted-in</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{campaign.templateName}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDateTime(campaign.startedAt || campaign.scheduledAt)}
                        </TableCell>
                        <TableCell>
                          <div className="w-28 space-y-1">
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${progressPct(campaign)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {campaign.sentCount}/{campaign.totalRecipients}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {readRate(campaign) != null ? `${readRate(campaign)}%` : "â€”"}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" title="View" asChild>
                              <Link href={`/dashboard/campaigns/${campaign.id}`}>
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            {isCampaignActive(campaign.status) && (
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
                                      Pending recipients will be skipped. Messages already sent are unaffected.
                                      This can't be undone.
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
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
            if (!open && segmentParam) router.replace("/dashboard/campaigns")
          }}
          context={context}
          onCreated={() => fetchCampaigns(true)}
          initialSegmentId={segmentParam ?? undefined}
        />
      )}
    </div>
  )
}
