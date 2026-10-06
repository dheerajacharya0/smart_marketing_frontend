"use client"

import { useState } from "react"
import { History, Loader2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/errors"
import type { CoexistenceSyncState } from "@/lib/coexistence-sync"
import { retryCoexistenceSync } from "@/services/api"

export interface CoexistenceSyncItem {
  key: string
  accountId: string
  phoneNumberId: string
  label: string
  state: CoexistenceSyncState
}

/**
 * Numbers connected through the WhatsApp Business app whose chat and contact
 * import didn't start. Meta allows 24 hours from connecting; inside that the
 * import can be retried here, after it the number has to be connected again.
 */
export function CoexistenceSyncBanners({
  items,
  onRetried,
}: {
  items: CoexistenceSyncItem[]
  onRetried?: () => void
}) {
  const visible = items.filter((i) => i.state.kind !== "none")
  if (visible.length === 0) return null
  return (
    <div className="space-y-3">
      {visible.map((item) => (
        <CoexistenceSyncBanner key={item.key} item={item} onRetried={onRetried} />
      ))}
    </div>
  )
}

function CoexistenceSyncBanner({ item, onRetried }: { item: CoexistenceSyncItem; onRetried?: () => void }) {
  const [retrying, setRetrying] = useState(false)
  const { state } = item

  const retry = async () => {
    setRetrying(true)
    try {
      const result = await retryCoexistenceSync(item.accountId, item.phoneNumberId)
      if (result.started) {
        toast.success("Import started — chats and contacts will appear over the next few minutes")
      } else {
        toast.error(`Meta didn't start the import: ${result.syncError ?? "unknown error"}`, { duration: 8000 })
      }
      onRetried?.()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't retry the import. Please try again."))
    } finally {
      setRetrying(false)
    }
  }

  if (state.kind === "expired") {
    return (
      <Alert className="border-warning/25 bg-warning-soft text-warning">
        <History className="h-4 w-4" />
        <AlertTitle>Chats from the WhatsApp Business app weren&apos;t imported</AlertTitle>
        <AlertDescription>
          <strong>{item.label}</strong> is connected and working, but Meta only allows the import within 24 hours of
          connecting. To bring in old chats and contacts, connect the number again from the WhatsApp Business app.
        </AlertDescription>
      </Alert>
    )
  }

  if (state.kind !== "retry") return null
  return (
    <Alert className="border-warning/25 bg-warning-soft text-warning">
      <History className="h-4 w-4" />
      <AlertTitle>Importing chats from the WhatsApp Business app didn&apos;t start</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0">
          <strong>{item.label}</strong> is connected, but its old chats and contacts haven&apos;t come across ({state.error}).
          Retry before {state.deadline.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} — Meta
          allows 24 hours.
        </span>
        <Button size="sm" variant="outline" className="shrink-0" onClick={retry} disabled={retrying}>
          {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {retrying ? "Retrying…" : "Retry import"}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
