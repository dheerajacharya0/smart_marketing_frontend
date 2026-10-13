import { Skeleton } from "@/components/ui/skeleton"
import { MetricRow } from "@/components/metric-card"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

/**
 * The dashboard home, not a generic list page — every login hits this one.
 *
 * `PageSkeleton` promised a flat header-plus-four-tiles-plus-rows shape; the
 * real page (below, once mounted) shows its own quite different skeleton per
 * section while data loads: 5 stat tiles (3 lines each, not plain boxes), a
 * titled chart card, an activity card, and a funnel+campaigns row. Shaping
 * this one the same way means the transition from "nothing mounted yet" to
 * "mounted and loading its own data" doesn't itself read as a layout jump —
 * see app/dashboard/page.tsx:456-602 for the skeletons this mirrors.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>

      <MetricRow>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="space-y-2 rounded-lg border border-border-subtle bg-card p-3.5 shadow-sm sm:p-4"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </MetricRow>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card variant="analytics" className="xl:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1.5 h-3.5 w-72 max-w-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-1.5 h-3.5 w-44" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card variant="elevated" className="lg:col-span-3">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1.5 h-3.5 w-80 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-1.5 h-3.5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-20" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  )
}
