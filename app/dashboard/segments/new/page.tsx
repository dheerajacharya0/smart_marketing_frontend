"use client"

import { Loader2 } from "lucide-react"
import { useAccountId } from "@/hooks/use-account-id"
import { SegmentBuilder } from "../segment-builder"

export default function NewSegmentPage() {
  const { accountId, resolved } = useAccountId()

  if (!resolved) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!accountId) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No connected account yet — link a Facebook/WhatsApp account first.
      </p>
    )
  }

  return <SegmentBuilder accountId={accountId} />
}
