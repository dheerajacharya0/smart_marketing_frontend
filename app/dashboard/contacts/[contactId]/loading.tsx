import { Skeleton } from "@/components/ui/skeleton"

/**
 * Mirrors the page's own `contact.isLoading` skeleton exactly (see
 * app/dashboard/contacts/[contactId]/page.tsx:75-84) instead of
 * `PageSkeleton`'s unrelated header-plus-four-tiles-plus-five-rows shape, so
 * the route-level fallback and the page's own loading state are the same
 * thing rather than two shapes in a row.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-64 md:col-span-1" />
        <Skeleton className="h-64 md:col-span-2" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
