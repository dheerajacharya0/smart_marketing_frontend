"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Meta phone-number quality rating → user-facing health badge.
// GREEN/UNFLAGGED are both "healthy"; RED/FLAGGED both "flagged".
export function isFlaggedQuality(rating: string | null | undefined): boolean {
  return rating === "RED" || rating === "FLAGGED"
}

export function relativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null
  const diffMs = Date.now() - then
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export function QualityBadge({
  rating,
  updatedAt,
}: {
  rating: string | null | undefined
  updatedAt?: string | null
}) {
  let badge: React.ReactNode
  if (rating === "GREEN" || rating === "UNFLAGGED") {
    badge = (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
        Healthy
      </Badge>
    )
  } else if (rating === "YELLOW") {
    badge = (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400">
        At risk
      </Badge>
    )
  } else if (isFlaggedQuality(rating)) {
    badge = (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-400">
        Flagged
      </Badge>
    )
  } else {
    badge = <Badge variant="secondary">No data yet</Badge>
  }

  const asOf = relativeTime(updatedAt)
  if (!asOf) return <>{badge}</>

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{badge}</span>
        </TooltipTrigger>
        <TooltipContent>as of {asOf}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const TIER_LABELS: Record<string, string> = {
  TIER_250: "250 msgs/day",
  TIER_1K: "1,000/day",
  TIER_10K: "10,000/day",
  TIER_100K: "100,000/day",
  TIER_UNLIMITED: "Unlimited",
}

// null for unknown/absent tiers — caller hides the chip.
export function messagingTierLabel(tier: string | null | undefined): string | null {
  if (!tier) return null
  return TIER_LABELS[tier] ?? null
}
