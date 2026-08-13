"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { getUserDataFromCookie, getActiveWhatsappContext, type WhatsappContext } from "@/services/api"
import { DripBuilder } from "../drip-builder"

export default function NewDripPage() {
  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    const user = getUserDataFromCookie()
    if (!user?.id) {
      setResolved(true)
      return
    }
    getActiveWhatsappContext()
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
        No registered WhatsApp number yet â€” finish the WhatsApp setup flow first.
      </p>
    )
  }

  return <DripBuilder context={context} />
}
