import type { ComponentType, ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface Stat {
  label: ReactNode
  value: ReactNode
  /** Optional sub-line under the value (e.g. a rate, delta, or hint). */
  hint?: ReactNode
  /** Optional lucide icon shown beside the label. */
  icon?: ComponentType<{ className?: string }>
  /** Tone accent for the value. */
  tone?: "default" | "success" | "warning" | "danger"
}

interface StatStripProps {
  stats: Stat[]
  className?: string
}

const toneClass: Record<NonNullable<Stat["tone"]>, string> = {
  default: "",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
}

/**
 * Headline metric row on the HUD panel system (`hud-strip`/`hud-stat` in
 * globals.css). Mono tabular numbers, responsive 2-up→4-up grid, dark aware.
 */
export function StatStrip({ stats, className }: StatStripProps) {
  return (
    // A lone stat takes the full width; in the 2-column phone grid it sat in
    // half a card with its hint wrapped into a narrow column.
    <div className={cn("hud-strip", stats.length === 1 && "!grid-cols-1", className)}>
      {stats.map((stat, i) => {
        const Icon = stat.icon
        return (
          <div key={i} className="hud-stat">
            <div className="hud-label flex items-center gap-1.5">
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {stat.label}
            </div>
            <div className={cn("hud-value", toneClass[stat.tone ?? "default"])}>{stat.value}</div>
            {stat.hint && <div className="text-xs text-muted-foreground">{stat.hint}</div>}
          </div>
        )
      })}
    </div>
  )
}
