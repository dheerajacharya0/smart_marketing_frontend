"use client"

import Link from "next/link"
import { Clock, AlertTriangle, Ban } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Campaign } from "@/services/api"

/**
 * Turns `deferredUntil` into something a human can act on.
 *
 * The estimate can be in the past — concurrent campaigns on one number can
 * overshoot the cap, and the backend stamps it once rather than re-deriving it
 * every tick. Showing a stale past time ("resumes at 2:15pm" when it's 4pm)
 * reads as broken, so a lapsed estimate degrades to the honest vaguer message.
 */
function resumeText(deferredUntil: string | null | undefined): string {
  if (!deferredUntil) return "Sending resumes automatically as the limit frees up."

  const at = new Date(deferredUntil)
  if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
    return "Sending resumes automatically. This should clear shortly."
  }

  return `Sending resumes automatically, expected around ${at.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}.`
}

/**
 * Explains a campaign that has stopped sending. Without this the campaign just
 * stalls silently — recipients sit `pending`, counters freeze, and nothing says
 * why.
 *
 * `deferredReason` can also be `"insufficient_balance"` in the type, but the
 * backend's enforcement switch has been permanently off since flat pricing
 * shipped 2026-10-10 (`billing.service.ts`'s `enforcementEnabled` always
 * returns `false`) — nothing can produce it on a new deferral, and a running
 * campaign self-clears it on its next dispatch tick. The branch below is kept
 * only so an already-stale pre-cutover row renders something sane instead of
 * falling through to the tier-cap copy, which would misname the reason.
 *
 * Renders nothing unless the campaign is actually deferred — or, for a
 * `scheduledAt` campaign whose audience resolved to nobody at send time, auto-
 * cancelled instead (see CampaignsService.materializeScheduled on the backend).
 */
export function CampaignDeferredBanner({
  campaign,
}: {
  campaign: Pick<Campaign, "status" | "deferredReason" | "deferredAt" | "deferredUntil" | "cancelReason">
}) {
  if (campaign.status === "cancelled" && campaign.cancelReason) {
    return (
      <Alert className="border-muted-foreground/30 bg-muted">
        <Ban className="h-4 w-4 text-muted-foreground" />
        <AlertTitle>Cancelled automatically</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          {campaign.cancelReason}
        </AlertDescription>
      </Alert>
    )
  }

  if (campaign.status !== "running" || !campaign.deferredReason) return null

  if (campaign.deferredReason === "insufficient_balance") {
    return (
      <Alert className="border-destructive/40 bg-destructive-soft">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <AlertTitle className="text-destructive">Paused on billing</AlertTitle>
        <AlertDescription className="text-destructive/80">
          <p>
            Sending stopped on a billing issue from before this flagged. The rest of this campaign
            is queued rather than cancelled, and nobody has been dropped.
          </p>
          <p className="mt-2">
            This is unexpected under the current plan.{" "}
            <Link href="/dashboard/support" className="font-medium underline underline-offset-4">
              Contact support
            </Link>{" "}
            to clear it.
          </p>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="border-warning/40 bg-warning-soft">
      <Clock className="h-4 w-4 text-warning" />
      <AlertTitle className="text-warning">
        Paused: daily limit reached for this number
      </AlertTitle>
      <AlertDescription className="text-warning/80">
        <p>
          WhatsApp limits how many <em>new</em> people each number can message in a 24-hour
          window. Yours has hit that limit, so the rest of this campaign is queued rather than
          cancelled. Nobody has been dropped. {resumeText(campaign.deferredUntil)}
        </p>
        <p className="mt-2">
          The limit rises automatically as you send consistently and keep your quality rating
          healthy.{" "}
          <Link href="/dashboard/whatsapp" className="font-medium underline underline-offset-4">
            Check your number&apos;s health
          </Link>
          .
        </p>
      </AlertDescription>
    </Alert>
  )
}
