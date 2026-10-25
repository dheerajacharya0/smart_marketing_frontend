"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusNote, Busy } from "@/components/onboarding/onboarding-ui"
import { getErrorMessage } from "@/lib/errors"
import { startNumberRecovery, confirmNumberRecovery } from "@/services/api"

type Step = "phone" | "code" | "verified"

/**
 * Recovers a number whose Embedded Signup popup finished at Meta (business
 * and number created) but lost `window.opener` before relaying anything back
 * to us — see connect-whatsapp-button.tsx's stuck-popup fallback and
 * BusinessService.startNumberRecovery for the full story. The customer types
 * the number back in; if it matches a WABA Meta already shares with us but we
 * have no record of, Meta sends an OTP straight to it — that OTP, not a fresh
 * Facebook login, is what proves it's theirs.
 *
 * Meta sometimes already ran that same ownership check itself, usually during
 * the original stuck signup, and refuses to re-send a code in that case
 * ("alreadyVerified") — the "verified" step skips straight to finishing
 * instead of asking for a code that was never sent.
 */
export function RecoverWhatsAppNumberDialog({
  open,
  onOpenChange,
  accountId,
  onRecovered,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  onRecovered: () => void
}) {
  const [step, setStep] = useState<Step>("phone")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [code, setCode] = useState("")
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStep("phone")
    setPhoneNumber("")
    setCode("")
    setPin("")
    setError(null)
  }

  const sendCode = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await startNumberRecovery(accountId, phoneNumber)
      setStep(result.alreadyVerified ? "verified" : "code")
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't check that number. Please try again."))
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await confirmNumberRecovery(accountId, phoneNumber, step === "verified" ? undefined : code, pin || undefined)
      reset()
      onRecovered()
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err, "That couldn't be confirmed. Please try again."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <div className="space-y-5 p-6">
          <div className="flex items-start gap-4 pr-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">Recover a number</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Already finished setup on Meta&apos;s side but it never showed up here? Enter the number and
                we&apos;ll check.
              </DialogDescription>
            </div>
          </div>

          {step === "phone" ? (
            <div className="space-y-2">
              <Label htmlFor="recover-phone">WhatsApp number</Label>
              <Input
                id="recover-phone"
                type="tel"
                autoComplete="off"
                placeholder="+91 98765 43210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {step === "verified" ? (
                  <>
                    Meta already confirmed{" "}
                    <span className="font-medium text-foreground">{phoneNumber}</span> is yours — no code needed.
                  </>
                ) : (
                  <>
                    We sent a code to <span className="font-medium text-foreground">{phoneNumber}</span>.
                  </>
                )}
              </p>
              {step === "code" ? (
                <div className="space-y-2">
                  <Label htmlFor="recover-code">Verification code</Label>
                  <Input
                    id="recover-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="recover-pin">6-digit PIN</Label>
                <Input
                  id="recover-pin"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000000"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Only needed for a brand-new number — choose any 6 digits. Leave blank if this number was already
                  active elsewhere.
                </p>
              </div>
            </div>
          )}

          {error ? <StatusNote tone="error">{error}</StatusNote> : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === "phone" ? (
            <Button disabled={!phoneNumber.trim() || busy} onClick={sendCode}>
              {busy ? <Busy>Checking…</Busy> : "Send code"}
            </Button>
          ) : (
            <Button disabled={(step === "code" && !code.trim()) || busy} onClick={confirm}>
              {busy ? <Busy>Connecting…</Busy> : "Verify & connect"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
