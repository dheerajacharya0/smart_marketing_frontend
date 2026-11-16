"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useActiveNumber } from "@/hooks/use-active-number"
import { LoadFailed } from "@/components/load-failed"
import { getFlowStarter } from "@/lib/flow-starters"
import { FlowBuilder } from "../flow-builder"
import { BroadcastLoader } from "@/components/broadcast-loader"

function Spinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <BroadcastLoader />
    </div>
  )
}

function NewFlowContent() {
  const { active: context, error, hasNoNumber, retry } = useActiveNumber()
  // `?starter=<id>` pre-fills from the starter library. An unknown id resolves
  // to undefined and falls through to a blank builder rather than erroring.
  const starter = getFlowStarter(useSearchParams().get("starter"))

  if (context) return <FlowBuilder context={context} starter={starter} />

  // Before "no number": a failed lookup says nothing about whether one is
  // connected, and the no-number copy sends people back through onboarding.
  if (error) {
    return (
      <LoadFailed
        className="py-12"
        message="Couldn't load your WhatsApp number."
        onRetry={() => void retry()}
      />
    )
  }

  if (hasNoNumber) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No registered WhatsApp number yet. Finish the WhatsApp setup flow first.
      </p>
    )
  }

  return <Spinner />
}

/**
 * useSearchParams needs a Suspense boundary or the production build fails
 * during static generation — see the `/_document` worker-crash note in the
 * repo's build troubleshooting.
 */
export default function NewFlowPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewFlowContent />
    </Suspense>
  )
}
