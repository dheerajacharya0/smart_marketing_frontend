"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, Megaphone, Play, Radio } from "lucide-react"

import type { Campaign, QualityAlert } from "@/services/api"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type ActivityTone = "neutral" | "positive" | "warning" | "live"

interface ActivityEntry {
  id: string
  at: number
  icon: React.ComponentType<{ className?: string }>
  tone: ActivityTone
  title: string
  detail?: string
  href?: string
}

const TONE_CLASS: Record<ActivityTone, string> = {
  neutral: "border-border-subtle bg-muted/60 text-muted-foreground",
  positive: "border-success/25 bg-success-soft text-success",
  warning: "border-warning/25 bg-warning-soft text-warning",
  live: "border-primary/25 bg-primary-soft text-primary",
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ""
  const diff = Date.now() - then
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return "just now"
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

/**
 * Builds the timeline out of what the product actually records — campaign
 * lifecycle timestamps and number-quality alerts. There is no generic activity
 * endpoint, so rather than invent one this merges the two real sources and
 * sorts them; a campaign contributes its most recent meaningful moment only,
 * so a single broadcast can't flood the feed.
 */
function buildEntries(campaigns: Campaign[], alerts: QualityAlert[]): ActivityEntry[] {
  const entries: ActivityEntry[] = []

  for (const c of campaigns) {
    const href = `/dashboard/campaigns/${c.id}`

    if (c.completedAt) {
      entries.push({
        id: `c-done-${c.id}`,
        at: new Date(c.completedAt).getTime(),
        icon: CheckCircle2,
        tone: "positive",
        title: `${c.name} finished`,
        detail: `${c.sentCount.toLocaleString()} sent · ${c.deliveredCount.toLocaleString()} delivered`,
        href,
      })
      continue
    }

    if (c.startedAt) {
      const running = c.status === "running"
      entries.push({
        id: `c-start-${c.id}`,
        at: new Date(c.startedAt).getTime(),
        icon: running ? Radio : Play,
        tone: running ? "live" : "neutral",
        title: running ? `${c.name} is sending` : `${c.name} started`,
        detail: `${c.sentCount.toLocaleString()} of ${c.totalRecipients.toLocaleString()} recipients`,
        href,
      })
      continue
    }

    entries.push({
      id: `c-new-${c.id}`,
      at: new Date(c.scheduledAt ?? c.createdAt).getTime(),
      icon: Megaphone,
      tone: "neutral",
      title: c.scheduledAt ? `${c.name} scheduled` : `${c.name} created`,
      detail: `${c.totalRecipients.toLocaleString()} recipients`,
      href,
    })
  }

  for (const a of alerts) {
    entries.push({
      id: `a-${a.id}`,
      at: new Date(a.createdAt).getTime(),
      icon: AlertTriangle,
      tone: "warning",
      title: `Quality rating changed to ${a.newRating.toLowerCase()}`,
      detail: a.displayPhoneNumber ? `Number ${a.displayPhoneNumber}` : a.reason ?? undefined,
      href: "/dashboard/notifications",
    })
  }

  return entries.filter((e) => Number.isFinite(e.at)).sort((a, b) => b.at - a.at)
}

/** Renders as a link when the entry points somewhere, a plain row otherwise. */
function ActivityRow({
  href,
  className,
  children,
}: {
  href?: string
  className: string
  children: React.ReactNode
}) {
  if (!href) return <div className={className}>{children}</div>
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

interface ActivityFeedProps {
  campaigns: Campaign[]
  alerts: QualityAlert[]
  loading?: boolean
  limit?: number
  className?: string
}

/**
 * Recent activity as a timeline rather than another table: a connecting rail,
 * a toned marker per event, and relative times. Reads as a story of the
 * account instead of a log dump.
 */
export function ActivityFeed({ campaigns, alerts, loading, limit = 6, className }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-1.5 py-1">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const entries = buildEntries(campaigns, alerts).slice(0, limit)

  if (entries.length === 0) {
    return (
      <p className={cn("py-6 text-center text-sm text-muted-foreground", className)}>
        Nothing has happened yet. Your first campaign will show up here.
      </p>
    )
  }

  return (
    <ol className={cn("relative space-y-1", className)}>
      {/* The rail. Stops short of the last marker so the timeline doesn't
          dangle past the final event. */}
      <span
        aria-hidden
        className="absolute bottom-8 left-4 top-4 w-px bg-gradient-to-b from-border via-border to-transparent"
      />

      {entries.map((entry, i) => {
        const rowClass = cn(
          "focus-ring relative flex gap-3 rounded-md p-2 transition-colors duration-fast ease-out-soft",
          entry.href && "hover:bg-accent/50",
        )
        return (
          <li key={entry.id} style={{ "--signal-index": i } as React.CSSProperties} className="signal-rise">
            <ActivityRow href={entry.href} className={rowClass}>
              <span
                className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                  TONE_CLASS[entry.tone],
                )}
              >
                <entry.icon className="h-3.5 w-3.5" />
                {entry.tone === "live" && (
                  <span className="signal-ping absolute inset-0 rounded-md bg-primary/25" />
                )}
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-sm font-medium leading-snug text-foreground">{entry.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {entry.detail}
                  {entry.detail ? " · " : ""}
                  {relativeTime(new Date(entry.at).toISOString())}
                </p>
              </div>
            </ActivityRow>
          </li>
        )
      })}
    </ol>
  )
}
