"use client"

import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { CampaignTimelinePoint } from "@/services/api"
import { bucketLabelFormatter, bucketTickFormatter, fillBuckets } from "../../analytics-utils"

// Categorical slots 1–4 of the active palette. Each theme defines its own
// harmonised set, so the chart restyles with the rest of the interface and
// never fights the surface it sits on. Series are also distinguished by
// legend and per-point tooltip, not colour alone.
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
  const points = useMemo(
    () => fillBuckets(timeline || [], interval, { sent: 0, delivered: 0, read: 0, replied: 0 }),
    [timeline, interval]
  )

  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No delivery activity yet.
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="bucket"
          tickFormatter={bucketTickFormatter(interval)}
          tickLine={false}
          axisLine={false}
          minTickGap={32}
        />
        <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                bucketLabelFormatter(interval)(payload?.[0]?.payload?.bucket ?? "")
              }
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {SERIES.map((key) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}
