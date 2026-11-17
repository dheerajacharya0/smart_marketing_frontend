"use client"

import { useParams } from "next/navigation"
import { getDrip } from "@/services/api"
import { getErrorStatus } from "@/lib/errors"
import { useActiveNumber } from "@/hooks/use-active-number"
import { useFreshLoad } from "@/hooks/use-fresh-load"
import { LoadFailed } from "@/components/load-failed"
import { DripBuilder } from "../../drip-builder"
import { BroadcastLoader } from "@/components/broadcast-loader"

export default function EditDripPage() {
  const params = useParams<{ dripId: string }>()
  const dripId = params.dripId
  const { active: context, error: contextError, hasNoNumber, retry: retryContext } = useActiveNumber()

  // Fetched fresh on every visit rather than through the query cache: the
  // builder seeds its form once, and a cached copy from last visit would be
  // edited and saved over newer changes.
  const accountId = context?.accountId
  const {
    data: drip,
    error,
    loading,
    retry,
  } = useFreshLoad(accountId && dripId ? () => getDrip(dripId, accountId) : null, `${accountId}:${dripId}`)

  if (context && drip) return <DripBuilder context={context} drip={drip} />

  // Each of these used to print "Sequence not found." — telling someone their
  // sequence was deleted when a request had merely failed.
  if (!context && contextError) {
    return (
      <LoadFailed className="py-12" message="Couldn't load your WhatsApp number." onRetry={() => void retryContext()} />
    )
  }
  if (hasNoNumber) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No registered WhatsApp number yet. Finish the WhatsApp setup flow first.
      </p>
    )
  }
  if (error) {
    // 404: gone. 400: the id in the URL isn't a valid one (UUID check). Both
    // mean there is nothing to load, so "try again" would be a false hope.
    const status = getErrorStatus(error)
    if (status === 404 || status === 400) {
      return <p className="text-muted-foreground py-12 text-center">Sequence not found.</p>
    }
    return (
      <LoadFailed
        className="py-12"
        message="Couldn't load this sequence. Anyone enrolled keeps moving through their steps."
        onRetry={retry}
      />
    )
  }
  if (!loading && !drip) {
    return <p className="text-muted-foreground py-12 text-center">Sequence not found.</p>
  }

  return (
    <div className="flex h-64 items-center justify-center">
      <BroadcastLoader />
    </div>
  )
}
