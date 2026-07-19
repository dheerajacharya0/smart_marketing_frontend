"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "react-hot-toast"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getDrip,
  type DripSequence,
  type WhatsappContext,
} from "@/services/api"
import { DripBuilder } from "../../drip-builder"

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
        const ctx = await getActiveWhatsappContext(user.id)
        setContext(ctx)
        if (ctx && params.dripId) {
          const res = await getDrip(params.dripId, ctx.accountId)
          setDrip(res)
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to load sequence")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [params.dripId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!context || !drip) {
    return <p className="text-muted-foreground py-12 text-center">Sequence not found.</p>
  }

  return <DripBuilder context={context} drip={drip} />
}
