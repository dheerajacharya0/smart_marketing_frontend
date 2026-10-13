import { PageSkeleton } from "@/components/ui/page-skeleton"

// Static support cards, no stat tiles — promising four and pulling them away
// is the layout jump a skeleton exists to avoid. Same fix as glossary.
export default function Loading() {
  return <PageSkeleton stats={false} rows={4} />
}
