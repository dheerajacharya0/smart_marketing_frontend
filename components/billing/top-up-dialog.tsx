"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { formatMoney, FALLBACK_CURRENCY } from "@/lib/money"
import { loadRazorpayCheckout } from "@/lib/razorpay"
import {
  createTopupOrder,
  getCurrentUser,
  getTaxProfile,
  getWallet,
  isServiceUnavailable,
  type TaxProfile,
} from "@/services/api"
import { queryKeys } from "@/hooks/use-queries"
import { startCreditWatch } from "@/lib/wallet-credit-watch"

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

/**
 * Whole currency units, matching the backend's RAZORPAY_MIN_TOPUP..MAX_TOPUP
 * range (1..100000 by default). Deliberately not currency-specific figures with
 * a symbol baked in — they render through the wallet's own currency.
 */
const PRESET_AMOUNTS = [500, 1000, 2000]

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
  // Passed down from the wallet response by the caller — never assumed here.
  currency = FALLBACK_CURRENCY,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string | null | undefined
  currency?: string
}) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState("")
  // Rate and heads of tax resolved server-side from the account's own profile —
  // intra-state splits into two lines, inter-state is one, outside India may be
  // zero-rated. Reimplementing those rules here would be a second copy that
  // drifts from the invoice.
  const [taxPreview, setTaxPreview] = useState<TaxProfile | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [creditedTo, setCreditedTo] = useState<string | null>(null)
  // Guards against a stale poll resolving after the dialog was closed/reopened.
  const runId = useRef(0)

  // Loaded when the dialog opens rather than on mount: it's only needed once
  // someone is actually about to pay, and a failure here must not block the
  // top-up — the order response carries the authoritative figures either way.
  useEffect(() => {
    if (!open || !accountId) return
    getTaxProfile(accountId)
      .then(setTaxPreview)
      .catch(() => setTaxPreview(null))
  }, [open, accountId])

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
   * Watch the wallet until the balance differs from the pre-payment snapshot.
   * Compares `balanceMicros` (exact integer string) rather than the rounded
   * decimal, so a sub-cent credit still registers.
   *
   * The watch outlives this dialog on purpose: closing it mid-"Confirming…"
   * must not stop the shared wallet cache (sidebar, billing card, banners) from
   * picking up the new balance. `runId` only gates this dialog's own UI; pass
   * `null` to watch without driving the UI at all.
   */
  const watchForCredit = (baselineMicros: string, myRun: number | null) => {
    const id = accountId as string
    const ownsUi = () => myRun !== null && runId.current === myRun
    startCreditWatch(id, {
      fetchWallet: () => getWallet(id),
      baselineMicros,
      onCredited: (wallet) => {
        queryClient.setQueryData(queryKeys.wallet(id), wallet)
        refreshBilling()
        if (!ownsUi()) return
        setCreditedTo(formatMoney(wallet.balance, wallet.currency))
        setPhase("confirmed")
      },
      // Not an error: the webhook can arrive well after the payment. Say so
      // honestly instead of claiming failure or faking a credit.
      onSlow: () => {
        refreshBilling()
        if (ownsUi()) setPhase("pending")
      },
      onGiveUp: refreshBilling,
    })
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
        // MINOR units (paise). `order.amount` is the whole-unit figure for
        // display — passing that here would charge 1/100th of the top-up.
        amount: order.amountMinorUnits,
        currency: order.currency,
        order_id: order.orderId,
        name: "Wallet top-up",
        description: "Prepaid messaging credit",
        prefill: { name: user?.name, email: user?.email },
        handler: () => {
          // Gateway accepted it. The wallet has NOT moved yet.
          if (runId.current !== myRun) return
          setPhase("confirming")
          watchForCredit(before.balanceMicros, myRun)
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
            // Some methods (UPI intent, netbanking redirects) can complete and
            // still end in a dismiss, so keep watching without claiming anything.
            watchForCredit(before.balanceMicros, null)
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
            <CheckCircle2 className="h-8 w-8 text-success" />
            <p className="font-medium">Top-up complete</p>
            <p className="text-sm text-muted-foreground">New balance {creditedTo}.</p>
          </div>
        ) : phase === "unavailable" ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertTriangle className="h-8 w-8 text-warning" />
            <p className="font-medium">Top-ups are unavailable right now</p>
            <p className="text-sm text-muted-foreground">
              The payment gateway isn&apos;t set up on this server yet. Your balance and sending
              are unaffected — contact support to enable payments.
            </p>
          </div>
        ) : phase === "pending" ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Clock className="h-8 w-8 text-warning" />
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
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={Number(amount) === preset ? "default" : "outline"}
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setAmount(String(preset))
                    setInlineError(null)
                  }}
                >
                  {formatMoney(preset, currency)}
                </Button>
              ))}
            </div>
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

            {/* Tax is added on top of the top-up, not carved out of it: the
                amount above is the wallet credit and the card is charged the
                total below. Showing only one of the two numbers means the
                gateway quotes a figure the customer never agreed to. */}
            {taxPreview && Number(amount) >= 1 && (
              <div className="rounded-md border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wallet credit</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(Number(amount), currency)}
                  </span>
                </div>
                {taxPreview.outputTax.percent > 0 ? (
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">
                      {taxPreview.outputTax.components.join(" + ") || "Tax"} (
                      {taxPreview.outputTax.percent}%)
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatMoney((Number(amount) * taxPreview.outputTax.percent) / 100, currency)}
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-mono tabular-nums">
                      {taxPreview.outputTax.kind === "export_zero_rated" ? "0% (export)" : "—"}
                    </span>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t pt-2 font-medium">
                  <span>You pay</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(
                      Number(amount) * (1 + taxPreview.outputTax.percent / 100),
                      currency
                    )}
                  </span>
                </div>
                {/* The exact figure comes back from the order; this is the
                    preview, rounded the same way but computed here. */}
                <p className="mt-2 text-xs text-muted-foreground">
                  Your balance goes up by {formatMoney(Number(amount), currency)} — the tax is
                  charged on top, not taken out of it.
                </p>
              </div>
            )}

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
