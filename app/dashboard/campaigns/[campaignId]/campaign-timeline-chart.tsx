"use client"

import { useId, useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { BarGradient, ChartSummary, axisProps, barCursor, gridProps } from "@/components/charts/chart-fx"
import type { CampaignTimelinePoint } from "@/services/api"
import { bucketLabelFormatter, bucketTickFormatter, fillBuckets } from "../../analytics-utils"

// Categorical slots of the active palette, so the chart restyles with the rest
// of the interface. Series are also named by the summary chips and tooltip, not
// colour alone.
const chartConfig = {
  sent: { label: "Sent", color: "hsl(var(--chart-1))" },
  delivered: { label: "Delivered", color: "hsl(var(--chart-2))" },
  read: { label: "Read", color: "hsl(var(--chart-3))" },
  replied: { label: "Replied", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig

const TOTALS = ["sent", "delivered", "read", "replied"] as const
/**
 * Plotted: sent, read, replied — the funnel's three steps that differ. Delivered
 * tracks sent almost exactly on a healthy list, so a fourth bar beside it only
 * crowded every bucket; it stays in the totals and the tooltip.
 */
const PLOTTED = ["sent", "read", "replied"] as const

export function CampaignTimelineChart({
  timeline,
  interval,
}: {
  timeline: CampaignTimelinePoint[]
  interval: "hour" | "day"
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const points = useMemo(
    () => fillBuckets(timeline || [], interval, { sent: 0, delivered: 0, read: 0, replied: 0 }),
    [timeline, interval]
  )
  const totals = useMemo(() => {
    const sum = { sent: 0, delivered: 0, read: 0, replied: 0 }
    for (const p of points) for (const key of TOTALS) sum[key] += Number(p[key] ?? 0)
    return sum
  }, [points])

  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No delivery activity yet.
      </div>
    )
  }

  return (
    <div>
      <ChartSummary
        items={TOTALS.map((key) => ({
          key,
          label: chartConfig[key].label,
          value: totals[key].toLocaleString(),
          color: chartConfig[key].color,
        }))}
      />
      <ChartContainer config={chartConfig} className="h-60 w-full aspect-auto">
        <BarChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
          <defs>
            {PLOTTED.map((key) => (
              <BarGradient key={key} id={`bar-${key}-${uid}`} color={`var(--color-${key})`} />
            ))}
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="bucket" tickFormatter={bucketTickFormatter(interval)} minTickGap={24} {...axisProps} />
          <YAxis width={32} allowDecimals={false} {...axisProps} />
          <ChartTooltip
            cursor={barCursor}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  bucketLabelFormatter(interval)(payload?.[0]?.payload?.bucket ?? "")
                }
              />
            }
          />
          {PLOTTED.map((key) => (
            <Bar key={key} dataKey={key} fill={`url(#bar-${key}-${uid})`} radius={[4, 4, 0, 0]} maxBarSize={14} />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  )
}
