"use client"

import { useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { useParams } from "next/navigation"
import { toast } from "react-hot-toast"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getDrip,
  type DripSequence,
  type WhatsappContext,
} from "@/services/api"
import { DripBuilder } from "../../drip-builder"
import { BroadcastLoader } from "@/components/broadcast-loader"

export default function EditDripPage() {
  const params = useParams<{ dripId: string }>()
  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [drip, setDrip] = useState<DripSequence | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) {
        setLoading(false)
        return
      }
      try {
        const ctx = await getActiveWhatsappContext()
        setContext(ctx)
        if (ctx && params.dripId) {
          const res = await getDrip(params.dripId, ctx.accountId)
          setDrip(res)
        }
      } catch (err) {
        toast.error(getErrorMessage(err) || "Failed to load sequence")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [params.dripId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <BroadcastLoader />
      </div>
    )
  }

  if (!context || !drip) {
    return <p className="text-muted-foreground py-12 text-center">Sequence not found.</p>
  }

  return <DripBuilder context={context} drip={drip} />
}
