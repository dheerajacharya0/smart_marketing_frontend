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
import { formatMoney } from "@/lib/money"
import type { LedgerTimeseries } from "@/services/api"

/**
 * Spend in slot 2 (the cool companion), attributed revenue in slot 1 — the
 * figure the page exists for takes the palette's lead colour.
 */
const chartConfig = {
  attributed: { label: "Revenue from WhatsApp", color: "hsl(var(--chart-1))" },
  spend: { label: "Spent on WhatsApp", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig

const dayTick = (day: string) => {
  const d = new Date(`${day}T00:00:00`)
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

/**
 * Daily spend next to the revenue it earned, as paired bars. Side by side, not
 * stacked: the two are different quantities, and a stack would add them.
 * Revenue lands on the day of the sale while spend lands on the day of the
 * send, so a campaign day and its sales days are expected to differ.
 */
export function LedgerChart({
  data,
  currency,
}: {
  data: LedgerTimeseries
  currency: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const points = useMemo(
    () =>
      data.points.map((p) => ({
        day: p.day,
        spend: p.spend.units,
        attributed: p.attributedRevenue.units,
      })),
    [data]
  )
  const totals = useMemo(
    () =>
      points.reduce(
        (sum, p) => ({ spend: sum.spend + p.spend, attributed: sum.attributed + p.attributed }),
        { spend: 0, attributed: 0 }
      ),
    [points]
  )
  const money = (v: number) => formatMoney(v, currency)

  return (
    <div>
      <ChartSummary
        items={[
          {
            key: "attributed",
            label: chartConfig.attributed.label,
            value: money(totals.attributed),
            color: chartConfig.attributed.color,
          },
          {
            key: "spend",
            label: chartConfig.spend.label,
            value: money(totals.spend),
            color: chartConfig.spend.color,
          },
        ]}
      />
      <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
        <BarChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
          <defs>
            <BarGradient id={`bar-rev-${uid}`} color="var(--color-attributed)" />
            <BarGradient id={`bar-spend-${uid}`} color="var(--color-spend)" />
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="day" tickFormatter={dayTick} minTickGap={24} {...axisProps} />
          <YAxis
            width={56}
            tickFormatter={(v: number) =>
              new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(v)
            }
            {...axisProps}
          />
          <ChartTooltip
            cursor={barCursor}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const day = payload?.[0]?.payload?.day as string | undefined
                  return day
                    ? new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })
                    : ""
                }}
                formatter={(value, name) => (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">
                      {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                    </span>
                    <span className="font-mono tabular-nums">{money(Number(value))}</span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="attributed" fill={`url(#bar-rev-${uid})`} radius={[5, 5, 0, 0]} maxBarSize={18} />
          <Bar dataKey="spend" fill={`url(#bar-spend-${uid})`} radius={[5, 5, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
