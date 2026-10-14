import { Skeleton } from "@/components/ui/skeleton"

/**
 * The template list is a grid of large preview cards (h-64 rounded-xl —
 * see page.tsx's own `isLoadingTemplates` skeleton), not the flat full-width
 * bars `PageSkeleton` drew. The create-template form itself is hidden until
 * "New Template" is clicked, so it isn't part of the initial shape either —
 * mirroring the description row, the preset-starter pill row, the search
 * bar, and the card grid actually visible on first paint.
 */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      <div className="flex items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 shrink-0 rounded-full" />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-9 w-full sm:w-64" />
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-16 shrink-0 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  )
}
