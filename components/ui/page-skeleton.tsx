import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shared loading skeletons for dashboard routes (Phase 3). A route's
 * `loading.tsx` renders one of these so navigation shows the shape of what is
 * coming instead of a blank flash.
 *
 * Pick the one that matches the screen. A skeleton that promises four stat
 * tiles to a page that has none is a worse lie than no skeleton at all — the
 * layout jumps the moment the real content lands, which is exactly what a
 * skeleton exists to prevent.
 */
export function PageSkeleton({
  rows = 6,
  stats = true,
}: {
  rows?: number
  /** Four tiles above the list. Turn off for a screen with no metrics. */
  stats?: boolean
}) {
  return (
    <div className="space-y-6 p-4 md:p-6" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* List / table rows */}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  )
}

/**
 * For the builders and editors — a campaign, a drip, a segment, a flow.
 *
 * Those screens are stacked cards of labelled fields, not a table, so they get
 * field-shaped blocks and a footer where the save button will be.
 */
export function FormSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <div className="space-y-6 p-4 md:p-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {Array.from({ length: sections }).map((_, section) => (
        <div key={section} className="space-y-4 rounded-lg border p-4 sm:p-6">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((__, field) => (
              <div key={field} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end gap-2">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  )
}
