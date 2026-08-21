"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, Lightbulb, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Insight } from "@/lib/insights"
import { cn } from "@/lib/utils"

/**
 * One suggestion, or nothing.
 *
 * The rules in `lib/insights.ts` decide what to say; this decides whether the
 * reader still wants to hear it. Anything shown on every visit to a screen
 * stops being read after the second one, so a banner can be dismissed and stays
 * gone — for a week, not forever. The conditions behind these are recurring
 * ones (a wallet runs low again, a sequence gets switched off again), and a
 * permanent dismissal would silence the second occurrence along with the first.
 */

const DISMISS_PREFIX = "insight-dismissed:"
const DISMISS_DAYS = 7
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000

function dismissedAt(id: string): number | null {
  try {
    const raw = window.localStorage.getItem(`${DISMISS_PREFIX}${id}`)
    if (!raw) return null
    const at = Number(raw)
    return Number.isFinite(at) ? at : null
  } catch {
    // Private browsing, a full quota, a blocked origin — none of them are a
    // reason to hide the banner or to crash the screen it sits on.
    return null
  }
}

export function InsightBanner({
  insight,
  className,
}: {
  /** Null renders nothing — every rule is allowed to have nothing to say. */
  insight: Insight | null
  className?: string
}) {
  // Undefined until the effect has read storage. Rendering the banner during
  // that first pass would flash a dismissed insight back on screen, and reading
  // localStorage while rendering breaks hydration.
  const [visible, setVisible] = React.useState<boolean | undefined>(undefined)
  const id = insight?.id

  React.useEffect(() => {
    if (!id) {
      setVisible(false)
      return
    }
    const at = dismissedAt(id)
    setVisible(at == null || Date.now() - at > DISMISS_MS)
  }, [id])

  if (!insight || !visible) return null

  const dismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(`${DISMISS_PREFIX}${insight.id}`, String(Date.now()))
    } catch {
      // Dismissal that doesn't survive a reload still beats a banner that
      // won't close now.
    }
  }

  const warning = insight.tone === "warning"
  const Icon = warning ? AlertTriangle : Lightbulb

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 sm:p-4",
        warning ? "border-warning/25 bg-warning-soft" : "border-border/60 bg-muted/40",
        className,
      )}
    >
      <Icon
        className={cn("mt-0.5 h-4 w-4 shrink-0", warning ? "text-warning" : "text-muted-foreground")}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1 space-y-2">
        <p className={cn("text-sm leading-relaxed", warning ? "text-warning" : "text-foreground")}>
          {insight.message}
        </p>
        {insight.action && (
          <Button asChild variant={warning ? "outline" : "soft"} size="sm">
            <Link href={insight.action.href}>{insight.action.label}</Link>
          </Button>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        // 44px touch target: the dismiss control is the one thing on this
        // banner someone reaches for on a phone.
        className="-mr-1 -mt-1 h-11 w-11 shrink-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
        onClick={dismiss}
        aria-label="Dismiss this suggestion"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
