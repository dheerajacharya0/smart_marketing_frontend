"use client"

import { useId, type ComponentType, type ReactNode } from "react"
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { LiveDot } from "@/components/status-pill"
import { cn } from "@/lib/utils"

interface SparklineProps {
  data: number[]
  /** Which palette slot to draw in. Charts never use library defaults. */
  tone?: "primary" | "accent" | "danger" | "muted"
  className?: string
}

const SPARK_TONE = {
  primary: "hsl(var(--chart-1))",
  accent: "hsl(var(--chart-2))",
  danger: "hsl(var(--destructive))",
  muted: "hsl(var(--muted-foreground))",
} as const

/**
 * Inline trend line. Hand-rolled SVG rather than a chart library — it renders
 * inside a stat tile at 32px tall and must not pull recharts into every page.
 * The fill fades to nothing so the tile keeps its calm, unboxed feel.
 */
export function Sparkline({ data, tone = "primary", className }: SparklineProps) {
  const gradientId = useId()

  if (!data || data.length < 2) return null

  const width = 100
  const height = 30
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((value - min) / span) * (height - 5) - 2.5
    return [x, y] as const
  })

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ")
  const area = `${line} L${width},${height} L0,${height} Z`
  const stroke = SPARK_TONE[tone]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={line}
        stroke={stroke}
        strokeWidth={1.75}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export interface MetricCardProps {
  label: ReactNode
  /** Numeric value — animates. Pass `display` instead for non-numeric values. */
  value?: number
  /** Pre-formatted value, used when the metric is not a plain number. */
  display?: ReactNode
  prefix?: string
  suffix?: string
  decimals?: number
  /** Period-over-period change, in percent. Positive is drawn as an increase. */
  delta?: number
  /** Set when an increase is bad (cost, failures, opt-outs). */
  invertDelta?: boolean
  /** One-line plain-English read. The rule: never ship a number unexplained. */
  read?: ReactNode
  /** Trend series for the sparkline. */
  trend?: number[]
  icon?: ComponentType<{ className?: string }>
  /** Marks the metric as updating in real time — shows a LiveDot. */
  live?: boolean
  /** Stagger position for the entrance animation. Capped at 8 by the caller. */
  index?: number
  /** Emphasis: the lead metric of a group gets more room and a tinted ground. */
  featured?: boolean
  className?: string
  onClick?: () => void
}

/**
 * The stat tile: label, animated value, period delta, sparkline, and a
 * plain-English read of what the number means.
 */
export function MetricCard({
  label,
  value,
  display,
  prefix,
  suffix,
  decimals = 0,
  delta,
  invertDelta,
  read,
  trend,
  icon: Icon,
  live,
  index = 0,
  featured,
  className,
  onClick,
}: MetricCardProps) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta)
  const isFlat = hasDelta && Math.abs(delta) < 0.05
  const isGood = hasDelta && !isFlat && (invertDelta ? delta < 0 : delta > 0)

  const DeltaIcon = !hasDelta || isFlat ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight
  const Root = onClick ? "button" : "div"

  return (
    <Root
      onClick={onClick}
      style={{ "--signal-index": index } as React.CSSProperties}
      className={cn(
        "signal-rise flex flex-col gap-3 rounded-lg border p-4 text-left sm:p-5",
        featured
          ? "surface-highlight"
          : "border-border-subtle bg-card bg-surface-sheen shadow-sm",
        onClick && "surface-interactive focus-ring cursor-pointer",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-label text-muted-foreground">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </span>
        {live && <LiveDot />}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cn(
            "font-mono font-semibold tabular-nums tracking-tight text-foreground",
            featured ? "text-3xl" : "text-2xl",
          )}
        >
          {display ?? (
            <AnimatedNumber value={value ?? 0} prefix={prefix} suffix={suffix} decimals={decimals} />
          )}
        </span>
        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-xs tabular-nums",
              isFlat && "bg-muted text-muted-foreground",
              !isFlat && isGood && "bg-success-soft text-success",
              !isFlat && !isGood && "bg-destructive-soft text-destructive",
            )}
          >
            <DeltaIcon className="h-3 w-3" />
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>

      {trend && trend.length > 1 && (
        <Sparkline data={trend} tone={hasDelta && !isGood && !isFlat ? "danger" : "primary"} />
      )}

      {read && <p className="text-xs leading-relaxed text-muted-foreground">{read}</p>}
    </Root>
  )
}

/**
 * Responsive container for MetricCards: a snap-scroll carousel on phones (a
 * four-row tower of stat tiles is unusable), 2-up on tablet, 4-up on desktop.
 */
export function MetricRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2",
        "[&>*]:min-w-[74vw] [&>*]:snap-start",
        "sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0",
        "sm:[&>*]:min-w-0 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  )
}
