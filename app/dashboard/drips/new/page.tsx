"use client"

import { useActiveNumber } from "@/hooks/use-active-number"
import { LoadFailed } from "@/components/load-failed"
import { DripBuilder } from "../drip-builder"
import { BroadcastLoader } from "@/components/broadcast-loader"

export default function NewDripPage() {
  const { active: context, error, hasNoNumber, retry } = useActiveNumber()

  if (context) return <DripBuilder context={context} />

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

  return (
    <div className="flex h-64 items-center justify-center">
      <BroadcastLoader />
    </div>
  )
}
