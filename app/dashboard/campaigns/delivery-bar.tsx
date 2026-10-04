import type { Campaign } from "@/services/api"
import { cn } from "@/lib/utils"

type Counts = Pick<
  Campaign,
  "status" | "totalRecipients" | "sentCount" | "deliveredCount" | "readCount" | "failedCount"
>

/**
 * A campaign's progress as one bar in four parts, each a share of everyone it
 * will reach: read, delivered but unread, sent but not yet delivered, and
 * failed. The empty remainder is who hasn't been sent to yet. A single "sent"
 * fill said a finished campaign and a campaign nobody read looked the same.
 *
 * Counts nest (read ⊂ delivered ⊂ sent), so each segment is the difference
 * between one step and the next, clamped so a late webhook can't push the
 * parts past 100%.
 */
export function DeliveryBar({ campaign, className }: { campaign: Counts; className?: string }) {
  // A `scheduledAt` campaign has no recipients yet — its audience resolves at
  // send time, not at creation (see CampaignAudienceMode on the backend) — so
  // 0/0 here means "not due yet", never "reaches nobody".
  if (campaign.status === "scheduled" && campaign.totalRecipients === 0) {
    return (
      <div className={cn("space-y-1", className)}>
        <div className="h-1.5 w-full rounded-full bg-muted" />
        <p className="text-xs text-muted-foreground">Audience resolves when it sends</p>
      </div>
    )
  }

  const total = Math.max(campaign.totalRecipients, campaign.sentCount + campaign.failedCount, 1)
  const read = Math.min(campaign.readCount, campaign.deliveredCount)
  const delivered = Math.max(0, campaign.deliveredCount - read)
  const sent = Math.max(0, campaign.sentCount - campaign.deliveredCount)
  const failed = campaign.failedCount
  const pct = (n: number) => `${(n / total) * 100}%`

  const segments = [
    { key: "read", value: read, className: "bg-primary" },
    { key: "delivered", value: delivered, className: "bg-primary/45" },
    { key: "sent", value: sent, className: "bg-muted-foreground/40" },
    { key: "failed", value: failed, className: "bg-destructive" },
  ].filter((s) => s.value > 0)

  const label = `${campaign.readCount} read, ${campaign.deliveredCount} delivered, ${campaign.sentCount} sent, ${failed} failed of ${campaign.totalRecipients}`

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={label} title={label}>
        {segments.map((s) => (
          <div
            key={s.key}
            className={cn("h-full transition-[width] duration-slow ease-out-soft", s.className)}
            style={{ width: pct(s.value) }}
          />
        ))}
      </div>
      <p className="font-mono text-xs tabular-nums text-muted-foreground">
        {campaign.sentCount}/{campaign.totalRecipients}
      </p>
    </div>
  )
}
