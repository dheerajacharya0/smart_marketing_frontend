"use client"

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

/**
 * Wallet top-ups are retired (decided 2026-09-30, see
 * docs/revenue-and-business-plan.md "No wallet, no markup"): the account no
 * longer pays a per-message platform fee, so `POST /billing/topup/order` now
 * refuses on the server with no replacement payment flow. This used to be the
 * full top-up dialog — amount entry, Razorpay Checkout, polling for the
 * credit to land — all of which is dead the moment the order call 400s, so it
 * says that plainly instead.
 *
 * `accountId`/`currency` stay in the prop signature, unused, so
 * `WalletBalanceCard` (the one caller) needs no change.
 */
export function TopUpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId?: string | null
  currency?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wallet top-ups are retired</DialogTitle>
          <DialogDescription>
            This plan no longer charges a fee per message, so there&apos;s nothing to top up.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Meta still bills your own card directly for WhatsApp messages — that&apos;s unaffected.
            Any existing wallet balance stays visible as history.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
