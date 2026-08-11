"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getErrorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import { creditWallet } from "@/services/api"
import { queryKeys } from "@/hooks/use-queries"

/**
 * Top-up modal (Feature 3B). Manual/admin credit — the payment gateway comes
 * later. Amount is in currency units and must be > 0; the backend returns the
 * new balance, which we toast and use to refresh the wallet + statement.
 */
export function TopUpDialog({
  open,
  onOpenChange,
  accountId,
  currency = "USD",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string | null | undefined
  currency?: string
}) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [inlineError, setInlineError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => creditWallet(accountId as string, Number(amount), reason || undefined),
    onSuccess: (wallet) => {
      toast.success(`Wallet topped up — new balance ${formatMoney(wallet.balance, wallet.currency)}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet(accountId ?? "") })
      queryClient.invalidateQueries({ queryKey: ["billing-entries", accountId ?? ""] })
      setAmount("")
      setReason("")
      setInlineError(null)
      onOpenChange(false)
    },
    onError: (err) => setInlineError(getErrorMessage(err, "Top-up failed")),
  })

  const numeric = Number(amount)
  const valid = accountId && amount.trim() !== "" && Number.isFinite(numeric) && numeric > 0

  const handleSubmit = () => {
    setInlineError(null)
    if (!valid) {
      setInlineError("Enter an amount greater than 0.")
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add credit</DialogTitle>
          <DialogDescription>
            Top up the prepaid wallet. Amount is in {currency}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="topup-amount">Amount ({currency})</Label>
            <Input
              id="topup-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="50.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="topup-reason">Reason (optional)</Label>
            <Input
              id="topup-reason"
              placeholder="Manual top-up"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {inlineError ? <p className="text-sm text-destructive">{inlineError}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add credit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
