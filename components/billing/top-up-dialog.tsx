"use client"

import { useCallback, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
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
import { loadRazorpayCheckout } from "@/lib/razorpay"
import { createTopupOrder, getCurrentUser, getWallet, isServiceUnavailable } from "@/services/api"
import { queryKeys } from "@/hooks/use-queries"

/**
 * Customer top-up (§3). The money path is:
 *
 *   POST /billing/topup/order  ->  Razorpay Checkout  ->  Razorpay webhook  ->  wallet
 *
 * The browser is never in the credit path. Checkout's success callback only
 * proves the gateway accepted the payment, so this dialog goes to a *pending*
 * state and confirms by polling GET /billing/wallet until the balance actually
 * moves. Nothing here credits optimistically, and a dismissed/failed Checkout is
 * not treated as proof that no payment happened — the webhook can still land.
 *
 * POST /billing/credit is admin-only and deliberately not used here.
 */

/** How long to wait for the webhook before saying "it's on its way". */
const POLL_INTERVAL_MS = 2000
const POLL_ATTEMPTS = 15 // ~30s

type Phase =
  | "idle"
  | "creating"
  | "checkout"
  | "confirming"
  | "confirmed"
  | "pending"
  /** Gateway keys aren't configured on the server (503) — retrying can't help. */
  | "unavailable"

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
  const [phase, setPhase] = useState<Phase>("idle")
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [creditedTo, setCreditedTo] = useState<string | null>(null)
  // Guards against a stale poll resolving after the dialog was closed/reopened.
  const runId = useRef(0)

  const refreshBilling = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.wallet(accountId ?? "") })
    queryClient.invalidateQueries({ queryKey: ["billing-entries", accountId ?? ""] })
    queryClient.invalidateQueries({ queryKey: ["topup-orders", accountId ?? ""] })
  }, [accountId, queryClient])

  const reset = (next: Phase = "idle") => {
    setPhase(next)
    setInlineError(null)
  }

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      runId.current += 1
      setAmount("")
      setCreditedTo(null)
      reset()
    }
    onOpenChange(nextOpen)
  }

  /**
   * Poll the wallet until the balance differs from the pre-payment snapshot.
   * Compares `balanceMicros` (exact integer string) rather than the rounded
   * decimal, so a sub-cent credit still registers.
   */
  const confirmByPolling = async (baselineMicros: string, myRun: number) => {
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      if (runId.current !== myRun) return
      try {
        const wallet = await getWallet(accountId as string)
        if (wallet.balanceMicros !== baselineMicros) {
          queryClient.setQueryData(queryKeys.wallet(accountId ?? ""), wallet)
          refreshBilling()
          setCreditedTo(formatMoney(wallet.balance, wallet.currency))
          setPhase("confirmed")
          return
        }
      } catch {
        // Transient read failure — keep polling; the webhook is what matters.
      }
    }
    if (runId.current !== myRun) return
    // Not an error: the webhook can arrive seconds later. Say so honestly
    // instead of claiming failure or faking a credit.
    refreshBilling()
    setPhase("pending")
  }

  const startTopUp = async () => {
    const numeric = Number(amount)
    setInlineError(null)
    if (!accountId) {
      setInlineError("No account connected.")
      return
    }
    if (!Number.isFinite(numeric) || numeric < 1) {
      setInlineError("Enter an amount of at least 1.")
      return
    }

    const myRun = ++runId.current
    setPhase("creating")
    try {
      // Snapshot first: the poll below needs a baseline taken before payment.
      const before = await getWallet(accountId)
      const [order, Razorpay] = await Promise.all([
        createTopupOrder(accountId, numeric),
        loadRazorpayCheckout(),
      ])
      if (runId.current !== myRun) return

      const user = getCurrentUser()
      const checkout = new Razorpay({
        key: order.keyId,
        // Already minor units from the backend — multiplying here charges 100x.
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Wallet top-up",
        description: "Prepaid messaging credit",
        prefill: { name: user?.name, email: user?.email },
        handler: () => {
          // Gateway accepted it. The wallet has NOT moved yet.
          if (runId.current !== myRun) return
          setPhase("confirming")
          void confirmByPolling(before.balanceMicros, myRun)
        },
        modal: {
          ondismiss: () => {
            if (runId.current !== myRun) return
            // A closed window is not proof the payment failed — if it went
            // through, the webhook still credits the wallet.
            setPhase("idle")
            setInlineError(
              "Checkout closed. If you completed the payment, your balance will update shortly."
            )
            refreshBilling()
          },
        },
      })
      setPhase("checkout")
      checkout.open()
    } catch (err) {
      if (runId.current !== myRun) return
      // 503 = the server has no payment gateway configured. That is an ops
      // problem, not a user mistake — say so and stop offering a retry button.
      if (isServiceUnavailable(err)) {
        setPhase("unavailable")
        return
      }
      setPhase("idle")
      setInlineError(getErrorMessage(err, "Couldn't start the top-up"))
    }
  }

  const busy = phase === "creating" || phase === "checkout" || phase === "confirming"

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add credit</DialogTitle>
          <DialogDescription>
            Top up the prepaid wallet. Amount is in {currency}; payment is handled by Razorpay.
          </DialogDescription>
        </DialogHeader>

        {phase === "confirmed" ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="font-medium">Top-up complete</p>
            <p className="text-sm text-muted-foreground">New balance {creditedTo}.</p>
          </div>
        ) : phase === "unavailable" ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="font-medium">Top-ups are unavailable right now</p>
            <p className="text-sm text-muted-foreground">
              The payment gateway isn&apos;t set up on this server yet. Your balance and sending
              are unaffected — contact support to enable payments.
            </p>
          </div>
        ) : phase === "pending" ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Clock className="h-8 w-8 text-amber-500" />
            <p className="font-medium">Payment received — balance updating</p>
            <p className="text-sm text-muted-foreground">
              Your bank confirmed the payment. Credit usually lands within a minute; this page
              refreshes on its own.
            </p>
          </div>
        ) : phase === "confirming" ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="font-medium">Confirming your payment…</p>
            <p className="text-sm text-muted-foreground">
              Waiting for the wallet to be credited. Don&apos;t pay again.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="topup-amount">Amount ({currency})</Label>
              <Input
                id="topup-amount"
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                placeholder="500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Minimum 1 {currency}.</p>
            </div>
            {inlineError ? <p className="text-sm text-destructive">{inlineError}</p> : null}
          </div>
        )}

        <DialogFooter>
          {phase === "confirmed" || phase === "pending" || phase === "unavailable" ? (
            <Button onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={startTopUp} disabled={busy || !accountId}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {phase === "creating" ? "Opening…" : "Continue to payment"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
