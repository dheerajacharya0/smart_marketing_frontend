"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { getUserDataFromCookie, getActiveWhatsappContext, type WhatsappContext } from "@/services/api"
import { FlowBuilder } from "../flow-builder"

export default function NewFlowPage() {
  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    const user = getUserDataFromCookie()
    if (!user?.id) {
      setResolved(true)
      return
    }
    getActiveWhatsappContext(user.id)
      .then(setContext)
      .catch(() => {})
      .finally(() => setResolved(true))
  }, [])

  if (!resolved) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!context) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No registered WhatsApp number yet — finish the WhatsApp setup flow first.
      </p>
    )
  }

  return <FlowBuilder context={context} />
}
