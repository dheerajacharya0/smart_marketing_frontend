"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { WALLET_EXHAUSTED_EVENT } from "@/services/api"

/**
 * Global reaction to a 402 (wallet exhausted) from any send (Feature 3, CRITICAL).
 * `apiRequest` broadcasts `WALLET_EXHAUSTED_EVENT`; this opens a top-up prompt
 * with the backend message instead of letting the send look like a crash.
 * Mounted once in the dashboard layout.
 */
export function WalletExhaustedProvider() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string>("")

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      setMessage(detail?.message || "Wallet balance exhausted — top up to continue sending.")
      setOpen(true)
    }
    window.addEventListener(WALLET_EXHAUSTED_EVENT, handler)
    return () => window.removeEventListener(WALLET_EXHAUSTED_EVENT, handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Top up your wallet
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button
            onClick={() => {
              setOpen(false)
              router.push("/dashboard/billing")
            }}
          >
            Add credit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
