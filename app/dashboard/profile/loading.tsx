import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

/**
 * No stat tiles, no list rows — a profile card (avatar + name + email), a
 * security card, and a wallet card. `PageSkeleton`'s header-plus-four-tiles
 * shape doesn't appear anywhere on this page, so it was a pure promise the
 * real content broke the instant it landed.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48 max-w-full" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-1.5 h-3.5 w-36" />
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-40" />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1.5 h-3.5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-28 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1.5 h-3.5 w-full max-w-md" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-40" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-9 w-32 rounded-md" />
        </CardFooter>
      </Card>

      <span className="sr-only">Loading…</span>
    </div>
  )
}
