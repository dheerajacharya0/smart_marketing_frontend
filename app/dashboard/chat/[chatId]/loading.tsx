import { Skeleton } from "@/components/ui/skeleton"

/**
 * The thread, not a page.
 *
 * `PageSkeleton` would be wrong here twice over: this route has no stat strip,
 * and its content is a conversation — alternating bubbles pinned to opposite
 * edges, with the composer at the bottom. Rows of equal grey bars would settle
 * into something that looks nothing like what arrives.
 */
export default function Loading() {
  // Deliberately uneven: real messages are not all one length, and a column of
  // identical widths reads as a loading bar rather than a conversation.
  const bubbles = [
    { incoming: true, width: "w-48" },
    { incoming: false, width: "w-64" },
    { incoming: true, width: "w-40" },
    { incoming: false, width: "w-52" },
    { incoming: true, width: "w-56" },
  ]

  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-live="polite">
      {/* Contact header */}
      <div className="flex items-center gap-3 border-b p-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-hidden p-4">
        {bubbles.map((bubble, i) => (
          <div key={i} className={bubble.incoming ? "flex" : "flex justify-end"}>
            <Skeleton className={`h-12 rounded-2xl ${bubble.width} max-w-[75%]`} />
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t p-4">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>

      <span className="sr-only">Loading conversation…</span>
    </div>
  )
}
