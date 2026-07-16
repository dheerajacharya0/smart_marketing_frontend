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

// Categorical slots 1–4 of the validated palette. Light-mode aqua/yellow sit
// below 3:1 contrast — relief comes from the legend + per-point tooltip.
const chartConfig = {
  sent: { label: "Sent", theme: { light: "#2a78d6", dark: "#3987e5" } },
  delivered: { label: "Delivered", theme: { light: "#1baf7a", dark: "#199e70" } },
  read: { label: "Read", theme: { light: "#eda100", dark: "#c98500" } },
  replied: { label: "Replied", theme: { light: "#008300", dark: "#008300" } },
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
