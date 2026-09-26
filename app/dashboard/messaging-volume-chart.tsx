"use client"

import { useId, useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { MessageSquare } from "lucide-react"
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
import type { MessagingAnalytics } from "@/services/api"
import { bucketLabelFormatter, bucketTickFormatter, fillBuckets } from "./analytics-utils"

/**
 * Series colours come from the active palette's chart slots, so the chart
 * restyles with the theme instead of carrying hardcoded hexes that clash with
 * six of the seven themes. Inbound takes slot 2, the palette's cool companion
 * to slot 1, so the two series separate by hue, not just lightness.
 */
const chartConfig = {
  outbound: { label: "Outbound", color: "hsl(var(--chart-1))" },
  inbound: { label: "Inbound", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig

export function MessagingVolumeChart({ data }: { data: MessagingAnalytics }) {
  // Unique per instance: two charts on one page must not share gradient ids.
  const uid = useId().replace(/:/g, "")
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
      <ChartSummary
        items={[
          { key: "outbound", label: "Outbound", value: totals.outbound.toLocaleString(), color: chartConfig.outbound.color },
          { key: "inbound", label: "Inbound", value: totals.inbound.toLocaleString(), color: chartConfig.inbound.color },
        ]}
      />
      <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
        <AreaChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <FadeGradient id={`fill-out-${uid}`} color="var(--color-outbound)" opacity={0.34} />
            <FadeGradient id={`fill-in-${uid}`} color="var(--color-inbound)" opacity={0.26} />
            <GlowFilter id={`glow-${uid}`} />
            <CursorGradient id={`cursor-${uid}`} />
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="bucket"
            tickFormatter={bucketTickFormatter(data.interval)}
            minTickGap={32}
            {...axisProps}
          />
          <YAxis width={40} allowDecimals={false} {...axisProps} />
          <ChartTooltip
            cursor={{ stroke: `url(#cursor-${uid})`, strokeWidth: 2 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  bucketLabelFormatter(data.interval)(payload?.[0]?.payload?.bucket ?? "")
                }
              />
            }
          />
          <Area
            type="monotone"
            dataKey="inbound"
            stroke="var(--color-inbound)"
            fill={`url(#fill-in-${uid})`}
            strokeWidth={2}
            filter={`url(#glow-${uid})`}
            dot={false}
            activeDot={activeDot("var(--color-inbound)")}
            animationDuration={900}
          />
          <Area
            type="monotone"
            dataKey="outbound"
            stroke="var(--color-outbound)"
            fill={`url(#fill-out-${uid})`}
            strokeWidth={2.5}
            filter={`url(#glow-${uid})`}
            dot={false}
            activeDot={activeDot("var(--color-outbound)")}
            animationDuration={900}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
