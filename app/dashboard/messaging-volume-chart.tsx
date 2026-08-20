"use client"

import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { MessageSquare } from "lucide-react"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { MessagingAnalytics } from "@/services/api"
import { bucketLabelFormatter, bucketTickFormatter, fillBuckets } from "./analytics-utils"

/**
 * Series colours come from the active palette's chart slots, so the chart
 * restyles with the theme instead of carrying hardcoded hexes that clash with
 * six of the seven themes.
 */
const chartConfig = {
  outbound: { label: "Outbound", color: "hsl(var(--chart-1))" },
  inbound: { label: "Inbound", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig

export function MessagingVolumeChart({ data }: { data: MessagingAnalytics }) {
  const points = useMemo(
    () => fillBuckets(data.points || [], data.interval, { inbound: 0, outbound: 0 }, data.range),
    [data]
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
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          {/* Soft fills, not solid blocks — the line stays the subject. */}
          <linearGradient id="fill-outbound" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-outbound)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="var(--color-outbound)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fill-inbound" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-inbound)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--color-inbound)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="hsl(var(--border-subtle))" strokeDasharray="4 4" />
        <XAxis
          dataKey="bucket"
          tickFormatter={bucketTickFormatter(data.interval)}
          tickLine={false}
          axisLine={false}
          minTickGap={32}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
        />
        <ChartTooltip
          cursor={{ stroke: "hsl(var(--border-strong))", strokeDasharray: "4 4" }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                bucketLabelFormatter(data.interval)(payload?.[0]?.payload?.bucket ?? "")
              }
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="outbound"
          stroke="var(--color-outbound)"
          fill="url(#fill-outbound)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="inbound"
          stroke="var(--color-inbound)"
          fill="url(#fill-inbound)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}
