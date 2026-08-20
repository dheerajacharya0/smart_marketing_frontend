import type React from "react"
import { cn } from "@/lib/utils"

/**
 * Loading placeholder. A sweep rather than a blink — it reads as content on
 * the way in instead of as something broken, and it inherits the active
 * palette like every other surface. Falls back to a static block under
 * `prefers-reduced-motion` (handled in globals.css).
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("signal-shimmer rounded-md bg-muted/70", className)} {...props} />
}

export { Skeleton }
