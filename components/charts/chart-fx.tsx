/**
 * Shared visual language for the product's charts: rounded bars with a soft
 * top-lit gradient, a highlighted column under the pointer, quiet axes, a
 * hairline grid, and a row of totals chips in place of a legend. Every colour
 * is a theme token, so charts follow the palette, light/dark, intensity and a
 * custom brand colour.
 *
 * Bars, not glowing lines: the product's series are counts per bucket, and on
 * real traffic — quiet days, short bursts — smoothed lines drew spikes and
 * curves between points that don't exist.
 *
 * Kept as SVG `<defs>` fragments and small components rather than a wrapper
 * chart, so each chart still composes recharts directly.
 */
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** A bar fill lit from the top: full colour at the cap, softer at the base. */
export function BarGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={1} />
      <stop offset="100%" stopColor={color} stopOpacity={0.55} />
    </linearGradient>
  )
}

/** The hovered bucket: a soft column behind its bars. */
export const barCursor = { fill: "hsl(var(--primary) / 0.08)", radius: 6 } as const

/** Shared axis styling: quiet, small, no lines. */
export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
} as const

/** Grid: horizontal hairlines only, barely there. */
export const gridProps = {
  vertical: false,
  stroke: "hsl(var(--border))",
  strokeOpacity: 0.45,
} as const

export interface SummaryItem {
  key: string
  label: string
  value: ReactNode
  color: string
}

/**
 * Totals per series. Replaces the legend: it names each series and says how
 * much of it there was, which a legend never did.
 */
export function ChartSummary({ items, className }: { items: SummaryItem[]; className?: string }) {
  return (
    <div className={cn("mb-3 flex flex-wrap gap-2", className)}>
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-2/60 px-3 py-1"
        >
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          <span className="text-xs text-muted-foreground">{item.label}</span>
          <span className="text-sm font-semibold tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  )
}
