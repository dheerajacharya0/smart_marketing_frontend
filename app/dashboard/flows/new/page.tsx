"use client"

import { swallow } from "@/lib/observability"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { getUserDataFromCookie, getActiveWhatsappContext, type WhatsappContext } from "@/services/api"
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
  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [resolved, setResolved] = useState(false)
  // `?starter=<id>` pre-fills from the starter library. An unknown id resolves
  // to undefined and falls through to a blank builder rather than erroring.
  const starter = getFlowStarter(useSearchParams().get("starter"))

  useEffect(() => {
    const user = getUserDataFromCookie()
    if (!user?.id) {
      setResolved(true)
      return
    }
    getActiveWhatsappContext()
      .then(setContext)
      .catch(swallow("app/dashboard/flows/new/page.tsx"))
      .finally(() => setResolved(true))
  }, [])

  if (!resolved) return <Spinner />

  if (!context) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No registered WhatsApp number yet — finish the WhatsApp setup flow first.
      </p>
    )
  }

  return <FlowBuilder context={context} starter={starter} />
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
