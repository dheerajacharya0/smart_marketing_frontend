"use client"

import { useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { useParams } from "next/navigation"
import { toast } from "react-hot-toast"
import { getSegment, type Segment } from "@/services/api"
import { useAccountId } from "@/hooks/use-account-id"
import { SegmentBuilder } from "../../segment-builder"
import { BroadcastLoader } from "@/components/broadcast-loader"

export default function EditSegmentPage() {
  const params = useParams<{ segmentId: string }>()
  const { accountId, resolved } = useAccountId()
  const [segment, setSegment] = useState<Segment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accountId || !params.segmentId) {
      if (resolved) setLoading(false)
      return
    }
    getSegment(params.segmentId, accountId)
      .then((res) => setSegment(res))
      .catch((err) => toast.error(getErrorMessage(err) || "Failed to load segment"))
      .finally(() => setLoading(false))
  }, [accountId, resolved, params.segmentId])

  if (!resolved || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <BroadcastLoader />
      </div>
    )
  }

  if (!accountId || !segment) {
    return <p className="text-muted-foreground py-12 text-center">Segment not found.</p>
  }

  return <SegmentBuilder accountId={accountId} segment={segment} />
}
