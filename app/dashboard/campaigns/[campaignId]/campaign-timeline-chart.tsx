"use client"

import { useId, useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  ChartSummary,
  CursorGradient,
  FadeGradient,
  GlowFilter,
  activeDot,
  axisProps,
  gridProps,
} from "@/components/charts/chart-fx"
import type { CampaignTimelinePoint } from "@/services/api"
import { bucketLabelFormatter, bucketTickFormatter, fillBuckets } from "../../analytics-utils"

// Categorical slots of the active palette. Each theme defines its own
// harmonised set, so the chart restyles with the rest of the interface and
// never fights the surface it sits on. Series are also distinguished by the
// summary chips and per-point tooltip, not colour alone.
const chartConfig = {
  sent: { label: "Sent", color: "hsl(var(--chart-1))" },
  delivered: { label: "Delivered", color: "hsl(var(--chart-2))" },
  read: { label: "Read", color: "hsl(var(--chart-3))" },
  replied: { label: "Replied", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig

const SERIES = ["sent", "delivered", "read", "replied"] as const

export function CampaignTimelineChart({
  timeline,
  interval,
}: {
  timeline: CampaignTimelinePoint[]
  interval: "hour" | "day"
}) {
  const uid = useId().replace(/:/g, "")
  const points = useMemo(
    () => fillBuckets(timeline || [], interval, { sent: 0, delivered: 0, read: 0, replied: 0 }),
    [timeline, interval]
  )
  const totals = useMemo(() => {
    const sum = { sent: 0, delivered: 0, read: 0, replied: 0 }
    for (const p of points) for (const key of SERIES) sum[key] += Number(p[key] ?? 0)
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
        items={SERIES.map((key) => ({
          key,
          label: chartConfig[key].label,
          value: totals[key].toLocaleString(),
          color: chartConfig[key].color,
        }))}
      />
      <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
        <AreaChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            {SERIES.map((key) => (
              // Only "sent" carries a visible wash; the rest sit inside it, and
              // four stacked fills turned the plot into mud.
              <FadeGradient
                key={key}
                id={`fill-${key}-${uid}`}
                color={`var(--color-${key})`}
                opacity={key === "sent" ? 0.28 : 0}
              />
            ))}
            <GlowFilter id={`glow-${uid}`} strength={2.5} />
            <CursorGradient id={`cursor-${uid}`} />
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="bucket" tickFormatter={bucketTickFormatter(interval)} minTickGap={32} {...axisProps} />
          <YAxis width={40} allowDecimals={false} {...axisProps} />
          <ChartTooltip
            cursor={{ stroke: `url(#cursor-${uid})`, strokeWidth: 2 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  bucketLabelFormatter(interval)(payload?.[0]?.payload?.bucket ?? "")
                }
              />
            }
          />
          {SERIES.map((key) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={`var(--color-${key})`}
              fill={`url(#fill-${key}-${uid})`}
              strokeWidth={key === "sent" ? 2.5 : 2}
              filter={`url(#glow-${uid})`}
              dot={false}
              activeDot={activeDot(`var(--color-${key})`)}
              animationDuration={900}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
