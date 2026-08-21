import { FormSkeleton } from "@/components/ui/page-skeleton"

// One file for every step: they share the [wabaId] layout, and each step is a
// short form under the stepper.
export default function Loading() {
  return <FormSkeleton sections={1} />
}
