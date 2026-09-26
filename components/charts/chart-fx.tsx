/**
 * Shared visual language for the product's charts: a soft neon glow on series
 * lines, fills that fade out below them, a highlight cursor, and a row of
 * summary chips in place of a legend. Every colour is a theme token, so charts
 * follow the palette, light/dark, intensity and a custom brand colour.
 *
 * Kept as SVG `<defs>` fragments and small components rather than a wrapper
 * chart, so each chart still composes recharts directly.
 */
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * A glow for series strokes. The blur is the stroke's own colour, merged under
 * the crisp line, so it never tints the chart a colour the theme didn't pick.
 * Filter region is widened: the default clips the glow at the plot edges.
 */
export function GlowFilter({ id, strength = 3 }: { id: string; strength?: number }) {
  return (
    <filter id={id} x="-10%" y="-40%" width="120%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation={strength} result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  )
}

/** A vertical fade from the series colour to nothing, for area fills. */
export function FadeGradient({ id, color, opacity = 0.32 }: { id: string; color: string; opacity?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={opacity} />
      <stop offset="55%" stopColor={color} stopOpacity={opacity * 0.35} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  )
}

/** Highlight cursor: a thin vertical beam that fades at both ends. */
export function CursorGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0} />
      <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
    </linearGradient>
  )
}

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

/** The hover dot: a filled point with a ring of the page colour and a glow. */
export function activeDot(color: string) {
  return {
    r: 5,
    fill: color,
    stroke: "hsl(var(--background))",
    strokeWidth: 2,
    style: { filter: `drop-shadow(0 0 6px ${color})` },
  }
}

export interface SummaryItem {
  key: string
  label: string
  value: ReactNode
  color: string
}

/**
 * Totals per series, above the plot. Replaces the legend: it names each series
 * and says how much of it there was, which a legend never did.
 */
export function ChartSummary({ items, className }: { items: SummaryItem[]; className?: string }) {
  return (
    <div className={cn("mb-3 flex flex-wrap gap-2", className)}>
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-2/60 px-3 py-1"
        >
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: item.color, boxShadow: `0 0 8px ${item.color}` }}
          />
          <span className="text-xs text-muted-foreground">{item.label}</span>
          <span className="text-sm font-semibold tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  )
}
