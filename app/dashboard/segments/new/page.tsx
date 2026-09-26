"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useAccountId } from "@/hooks/use-account-id"
import { getSegmentStarter } from "@/lib/segment-starters"
import { SegmentBuilder } from "../segment-builder"
import { BroadcastLoader } from "@/components/broadcast-loader"

function Spinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <BroadcastLoader />
    </div>
  )
}

function NewSegmentContent() {
  const { accountId, resolved } = useAccountId()
  // `?starter=<id>` pre-fills from the starter library. An unknown id resolves
  // to undefined and falls through to a blank builder rather than erroring —
  // a stale bookmark shouldn't be a dead end.
  const starter = getSegmentStarter(useSearchParams().get("starter"))

  if (!resolved) return <Spinner />

  if (!accountId) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No connected account yet — link a Facebook/WhatsApp account first.
      </p>
    )
  }

  return <SegmentBuilder accountId={accountId} starter={starter} />
}

/**
 * useSearchParams needs a Suspense boundary or the production build fails
 * during static generation — see the `/_document` worker-crash note in the
 * repo's build troubleshooting.
 */
export default function NewSegmentPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewSegmentContent />
    </Suspense>
  )
}
