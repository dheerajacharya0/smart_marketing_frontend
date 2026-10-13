import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

/**
 * This page already documents its own rule — "Skeletons shaped like the rows
 * they replace, so the card doesn't resize when the alerts land" — for its
 * inner `isLoading` state. `PageSkeleton`'s generic bars ignored that rule
 * for the route-level fallback, so navigation briefly showed a shape with no
 * tabs and no card chrome before flipping to the real tabbed layout. Mirrors
 * the 3-tab bar and the icon-row cards this page actually uses.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      <div className="w-full max-w-md">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-1.5 h-3.5 w-full max-w-lg" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 rounded-lg border p-4">
              <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-full max-w-md" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <span className="sr-only">Loading…</span>
    </div>
  )
}
