import { PageSkeleton } from "@/components/ui/page-skeleton"

// No stat tiles on this screen — promising four and then removing them is the
// layout jump a skeleton exists to avoid.
export default function Loading() {
  return <PageSkeleton stats={false} rows={8} />
}
