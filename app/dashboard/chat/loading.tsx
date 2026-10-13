import { Skeleton } from "@/components/ui/skeleton"

/**
 * The inbox's resting pane, not a data page.
 *
 * `PageSkeleton` was wrong here the same way it was wrong for the thread
 * route (see chat/[chatId]/loading.tsx): this is a centered "pick a
 * conversation" empty state, not a header-plus-stats-plus-list screen. The
 * mismatch was also doubled up in practice — this fallback covers only the
 * `page.tsx` content in `ChatLayout`'s right pane, while `ChatSidebar` in the
 * left pane is independently showing its own avatar-row skeleton for the
 * conversation list. A generic stat-grid flashing in next to that for a
 * moment, then getting replaced by a plain centered icon once the real
 * (static, no data to wait on) page lands, is the "two different skeletons"
 * jump this is fixing — shaped like the actual target now instead.
 */
export default function Loading() {
  return (
    <div className="flex h-full items-center justify-center p-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <Skeleton className="mb-5 h-16 w-16 rounded-xl" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2.5 h-4 w-64 max-w-full" />
        <Skeleton className="mt-6 h-9 w-44 rounded-md" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
