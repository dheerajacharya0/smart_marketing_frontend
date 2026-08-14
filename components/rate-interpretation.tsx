"use client"

import { AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DELIVERY_BENCHMARK,
  FAILURE_BENCHMARK,
  READ_BENCHMARK,
  type RateBenchmark,
  type Verdict,
} from "@/lib/benchmarks"
import type { AnalyticsRates } from "@/services/api"

/**
 * "What do these numbers mean?" — turns the rate tiles into advice.
 *
 * The tiles say 62% and colour it green; this says why that's fine and what to
 * do when it isn't. Only rates with something worth saying appear: a healthy
 * failure rate produces no line, because "your failure rate is fine" is noise.
 * When every rate is healthy the card collapses to a single confirmation rather
 * than four restatements of the tiles above it.
 *
 * Renders nothing at all when there's no data to interpret — an account that
 * hasn't sent yet gets the setup checklist, not an empty analysis panel.
 */

const ORDER: { benchmark: RateBenchmark; read: (rates: AnalyticsRates) => number }[] = [
  { benchmark: FAILURE_BENCHMARK, read: (r) => r.failureRate },
  { benchmark: DELIVERY_BENCHMARK, read: (r) => r.deliveryRate },
  { benchmark: READ_BENCHMARK, read: (r) => r.readRate },
]

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  if (verdict === "poor") return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
  if (verdict === "ok") return <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
  return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
}

export function RateInterpretation({
  rates,
  /** Sends in the period. Zero means the rates are all 0/0 and say nothing. */
  sentCount,
}: {
  rates: AnalyticsRates | undefined
  sentCount: number
}) {
  if (!rates || sentCount === 0) return null

  const findings = ORDER.map(({ benchmark, read }) => {
    const rate = read(rates)
    const verdict = benchmark.verdict(rate)
    return { benchmark, rate, verdict, text: benchmark.interpret(verdict) }
  }).filter((finding) => finding.text)

  // Worst first — if something needs fixing, it shouldn't be third in the list.
  const RANK: Record<Verdict, number> = { poor: 0, ok: 1, good: 2, none: 3 }
  findings.sort((a, b) => RANK[a.verdict] - RANK[b.verdict])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">What these numbers mean</CardTitle>
        <CardDescription>
          Rules of thumb for orientation, not measured industry averages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {findings.length === 0 ? (
          <div className="flex items-start gap-2">
            <VerdictIcon verdict="good" />
            <p className="text-sm">
              Nothing needs attention — delivery, reads and failures are all in a healthy range.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {findings.map((finding) => (
              <li key={finding.benchmark.key} className="flex items-start gap-2">
                <VerdictIcon verdict={finding.verdict} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {finding.benchmark.label}: {finding.rate}%
                    {finding.benchmark.benchmark ? (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        ({finding.benchmark.benchmark})
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{finding.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
