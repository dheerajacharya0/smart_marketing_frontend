"use client"

import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
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

// Categorical slots 1–2 of the validated palette (light/dark selected per mode)
const chartConfig = {
  outbound: {
    label: "Outbound",
    theme: { light: "#2a78d6", dark: "#3987e5" },
  },
  inbound: {
    label: "Inbound",
    theme: { light: "#1baf7a", dark: "#199e70" },
  },
} satisfies ChartConfig

export function MessagingVolumeChart({ data }: { data: MessagingAnalytics }) {
  const points = useMemo(
    () => fillBuckets(data.points || [], data.interval, { inbound: 0, outbound: 0 }, data.range),
    [data]
  )

  if (!data.points || data.points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="rounded-full bg-accent p-3 mb-3">
          <MessageSquare className="h-6 w-6 text-accent-foreground" />
        </div>
        <p className="text-sm font-medium">No messaging activity yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Volume appears here once your WhatsApp numbers start sending and receiving messages.
        </p>
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="bucket"
          tickFormatter={bucketTickFormatter(data.interval)}
          tickLine={false}
          axisLine={false}
          minTickGap={32}
        />
        <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(_, payload) =>
            bucketLabelFormatter(data.interval)(payload?.[0]?.payload?.bucket ?? "")
          } />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="outbound"
          stroke="var(--color-outbound)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="inbound"
          stroke="var(--color-inbound)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  )
}
