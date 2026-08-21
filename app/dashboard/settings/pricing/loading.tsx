import { PageSkeleton } from "@/components/ui/page-skeleton"

// Three markup figures and two small forms — closer to a stat page than a list.
export default function Loading() {
  return <PageSkeleton rows={3} />
}
