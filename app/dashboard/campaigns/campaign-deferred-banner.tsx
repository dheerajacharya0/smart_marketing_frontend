"use client"

import Link from "next/link"
import { Clock, Wallet } from "lucide-react"
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
    return "Sending resumes automatically — this should clear shortly."
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
 * The two reasons need opposite advice, so they get separate copy rather than a
 * shared template: a tier cap clears itself on a clock and the user should wait,
 * an empty wallet never clears without a top-up. Telling someone to sit tight
 * while their broadcast is frozen on a payment is the worse of the two errors.
 *
 * Renders nothing unless the campaign is actually deferred.
 */
export function CampaignDeferredBanner({
  campaign,
}: {
  campaign: Pick<Campaign, "status" | "deferredReason" | "deferredAt" | "deferredUntil">
}) {
  if (campaign.status !== "running" || !campaign.deferredReason) return null

  if (campaign.deferredReason === "insufficient_balance") {
    return (
      <Alert className="border-red-500/40 bg-red-50 dark:bg-red-950/30">
        <Wallet className="h-4 w-4 text-red-600 dark:text-red-400" />
        <AlertTitle className="text-red-900 dark:text-red-200">
          Paused — your wallet is empty
        </AlertTitle>
        <AlertDescription className="text-red-900/80 dark:text-red-200/80">
          <p>
            Sending stopped when the balance ran out. The rest of this campaign is queued rather
            than cancelled — nobody has been dropped, and sending picks up on its own once there is
            balance again.
          </p>
          <p className="mt-2">
            This one does <strong>not</strong> clear by waiting.{" "}
            <Link href="/dashboard/billing" className="font-medium underline underline-offset-4">
              Top up your wallet
            </Link>{" "}
            to resume.
          </p>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="border-orange-500/40 bg-orange-50 dark:bg-orange-950/30">
      <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      <AlertTitle className="text-orange-900 dark:text-orange-200">
        Paused — daily limit reached for this number
      </AlertTitle>
      <AlertDescription className="text-orange-900/80 dark:text-orange-200/80">
        <p>
          WhatsApp limits how many <em>new</em> people each number can message in a 24-hour
          window. Yours has hit that limit, so the rest of this campaign is queued rather than
          cancelled — nobody has been dropped. {resumeText(campaign.deferredUntil)}
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
