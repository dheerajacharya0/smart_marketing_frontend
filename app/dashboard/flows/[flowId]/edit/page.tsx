"use client"

import { useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "react-hot-toast"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getFlow,
  type Flow,
  type WhatsappContext,
} from "@/services/api"
import { FlowBuilder } from "../../flow-builder"

export default function EditFlowPage() {
  const params = useParams<{ flowId: string }>()
  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [flow, setFlow] = useState<Flow | null>(null)
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
        if (ctx && params.flowId) {
          const res = await getFlow(params.flowId, ctx.accountId)
          setFlow(res)
        }
      } catch (err) {
        toast.error(getErrorMessage(err) || "Failed to load flow")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [params.flowId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!context || !flow) {
    return <p className="text-muted-foreground py-12 text-center">Flow not found.</p>
  }

  return <FlowBuilder context={context} flow={flow} />
}
