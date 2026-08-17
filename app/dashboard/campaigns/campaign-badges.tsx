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
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-400">
        Needs a top-up
      </Badge>
    ) : (
      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-400">
        Waiting on daily limit
      </Badge>
    )
  }

  switch (status) {
    case "scheduled":
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400">
          Scheduled
        </Badge>
      )
    case "running":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400 animate-pulse">
          Running
        </Badge>
      )
    case "paused":
      // Not pulsing, and not the orange of a deferral: this one stopped because
      // someone chose to stop it, and it stays stopped until someone resumes it.
      return (
        <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300">
          Paused
        </Badge>
      )
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
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
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400">
          Sent
        </Badge>
      )
    case "delivered":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
          Delivered
        </Badge>
      )
    case "read":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400">
          Read
        </Badge>
      )
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-400">
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
