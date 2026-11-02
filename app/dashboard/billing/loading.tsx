import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

function TableCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-1.5 h-3.5 w-56" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </CardContent>
    </Card>
  )
}

/**
 * This page has no stat tiles — it's the usage-by-feature breakdown then the
 * invoices table, each its own component with its own data. `PageSkeleton`'s
 * generic bars matched none of that.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <TableCardSkeleton rows={3} />
      <TableCardSkeleton />

      <span className="sr-only">Loading…</span>
    </div>
  )
}
