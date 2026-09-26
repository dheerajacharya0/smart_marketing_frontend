"use client"

import { useId, useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { MessageSquare } from "lucide-react"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { BarGradient, ChartSummary, axisProps, barCursor, gridProps } from "@/components/charts/chart-fx"
import type { MessagingAnalytics } from "@/services/api"
import { bucketLabelFormatter, bucketTickFormatter, fillBuckets } from "./analytics-utils"

/**
 * Series colours come from the active palette's chart slots, so the chart
 * restyles with the theme instead of carrying hardcoded hexes. Inbound takes
 * slot 2, the palette's cool companion to slot 1, so the stacks separate by hue.
 */
const chartConfig = {
  outbound: { label: "Outbound", color: "hsl(var(--chart-1))" },
  inbound: { label: "Inbound", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig

/**
 * Daily volume as stacked bars. It was two smoothed, glowing lines, which on
 * real traffic — quiet days and short bursts — drew a heart monitor: spikes,
 * crossings, and curves that bowed between points that don't exist. A bar per
 * bucket says exactly "this many that day", and an empty day is just a gap.
 */
export function MessagingVolumeChart({ data }: { data: MessagingAnalytics }) {
  // Unique per instance: two charts on one page must not share gradient ids.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const points = useMemo(
    () => fillBuckets(data.points || [], data.interval, { inbound: 0, outbound: 0 }, data.range),
    [data]
  )
  const totals = useMemo(
    () =>
      points.reduce(
        (sum, p) => ({ outbound: sum.outbound + (p.outbound ?? 0), inbound: sum.inbound + (p.inbound ?? 0) }),
        { outbound: 0, inbound: 0 },
      ),
    [points],
  )

  if (!data.points || data.points.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border-subtle bg-surface-2 shadow-sm">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-medium">No messaging activity yet</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
          Volume appears here once your WhatsApp numbers start sending and receiving messages.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">
            {(totals.outbound + totals.inbound).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">messages in this range</p>
        </div>
        <ChartSummary
          className="mb-0"
          items={[
            { key: "outbound", label: "Outbound", value: totals.outbound.toLocaleString(), color: chartConfig.outbound.color },
            { key: "inbound", label: "Inbound", value: totals.inbound.toLocaleString(), color: chartConfig.inbound.color },
          ]}
        />
      </div>
      <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
        <BarChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
          <defs>
            <BarGradient id={`bar-out-${uid}`} color="var(--color-outbound)" />
            <BarGradient id={`bar-in-${uid}`} color="var(--color-inbound)" />
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="bucket"
            tickFormatter={bucketTickFormatter(data.interval)}
            minTickGap={24}
            {...axisProps}
          />
          <YAxis width={32} allowDecimals={false} {...axisProps} />
          <ChartTooltip
            cursor={barCursor}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  bucketLabelFormatter(data.interval)(payload?.[0]?.payload?.bucket ?? "")
                }
              />
            }
          />
          {/* Outbound at the base, inbound on top — only the top segment gets
              the rounded cap, so each stack reads as one bar. */}
          <Bar dataKey="outbound" stackId="volume" fill={`url(#bar-out-${uid})`} radius={[0, 0, 3, 3]} maxBarSize={22} />
          <Bar dataKey="inbound" stackId="volume" fill={`url(#bar-in-${uid})`} radius={[5, 5, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
