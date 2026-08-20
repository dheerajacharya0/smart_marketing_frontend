"use client"

import { Badge } from "@/components/ui/badge"
import type { Campaign, CampaignStatus, CampaignRecipientStatus } from "@/services/api"

/**
 * A `running` campaign that the dispatcher can't currently send from — either
 * the number hit its messaging-tier daily cap or the wallet ran dry. Status
 * stays `running` server-side, so this is checked separately from `status`.
 */
export function isCampaignDeferred(campaign: Pick<Campaign, "status" | "deferredReason">): boolean {
  return campaign.status === "running" && Boolean(campaign.deferredReason)
}

export function CampaignStatusBadge({
  status,
  deferredReason,
}: {
  status: CampaignStatus
  deferredReason?: Campaign["deferredReason"]
}) {
  // A deferred campaign is still `running`, but showing a pulsing "Running"
  // badge for something that is sending nothing reads as a lie. The two reasons
  // get different labels because only one of them clears on its own.
  if (status === "running" && deferredReason) {
    return deferredReason === "insufficient_balance" ? (
      <Badge className="bg-destructive-soft text-destructive hover:bg-destructive-soft">
        Needs a top-up
      </Badge>
    ) : (
      <Badge className="bg-warning-soft text-warning hover:bg-warning-soft">
        Waiting on daily limit
      </Badge>
    )
  }

  switch (status) {
    case "scheduled":
      return (
        <Badge className="bg-info-soft text-info hover:bg-info-soft">
          Scheduled
        </Badge>
      )
    case "running":
      return (
        <Badge className="bg-warning-soft text-warning hover:bg-warning-soft animate-pulse">
          Running
        </Badge>
      )
    case "paused":
      // Not pulsing, and not the orange of a deferral: this one stopped because
      // someone chose to stop it, and it stays stopped until someone resumes it.
      return (
        <Badge className="bg-muted text-foreground hover:bg-muted">
          Paused
        </Badge>
      )
    case "completed":
      return (
        <Badge className="bg-success-soft text-success hover:bg-success-soft">
          Completed
        </Badge>
      )
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function RecipientStatusBadge({ status }: { status: CampaignRecipientStatus }) {
  switch (status) {
    case "pending":
      return <Badge variant="outline">Pending</Badge>
    case "sent":
      return (
        <Badge className="bg-info-soft text-info hover:bg-info-soft">
          Sent
        </Badge>
      )
    case "delivered":
      return (
        <Badge className="bg-success-soft text-success hover:bg-success-soft">
          Delivered
        </Badge>
      )
    case "read":
      return (
        <Badge className="bg-success-soft text-success hover:bg-success-soft">
          Read
        </Badge>
      )
    case "failed":
      return (
        <Badge className="bg-destructive-soft text-destructive hover:bg-destructive-soft">
          Failed
        </Badge>
      )
    case "skipped":
      return <Badge variant="secondary">Skipped</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

/**
 * A campaign still changes server-side only in these states — used to decide
 * polling. `paused` is excluded on purpose: nothing moves until a human resumes
 * it, so polling it is a request per interval that can never return news.
 */
export function isCampaignActive(status: CampaignStatus | undefined): boolean {
  return status === "scheduled" || status === "running"
}

/** States a campaign can still be stopped or restarted from. */
export function canPauseCampaign(status: CampaignStatus | undefined): boolean {
  return status === "scheduled" || status === "running"
}

export function canResumeCampaign(status: CampaignStatus | undefined): boolean {
  return status === "paused"
}

/** `paused` is cancellable directly — no need to resume first just to stop it. */
export function canCancelCampaign(status: CampaignStatus | undefined): boolean {
  return status === "scheduled" || status === "running" || status === "paused"
}
