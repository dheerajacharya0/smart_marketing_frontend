"use client"

import { useState } from "react"
import { ExternalLink, Unplug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusNote, Busy } from "@/components/onboarding/onboarding-ui"
import { getErrorMessage } from "@/lib/errors"
import { disconnectWhatsappPhone } from "@/services/api"

/** Meta's own page for deleting a number from WhatsApp altogether. */
const WHATSAPP_MANAGER_NUMBERS = "https://business.facebook.com/wa/manage/phone-numbers/"

/** What the person must type to confirm: the number's digits, else DISCONNECT. */
export function disconnectConfirmation(phoneNumber: string | null | undefined): string {
  const digits = (phoneNumber ?? "").replace(/\D/g, "")
  return digits || "DISCONNECT"
}

/** Whether what was typed matches, ignoring spaces, dashes and a leading +. */
export function confirmationMatches(typed: string, expected: string): boolean {
  const clean = (s: string) => s.replace(/[\s\-+()]/g, "").toUpperCase()
  return clean(typed) === clean(expected)
}

/**
 * Take a number out of this workspace. Modelled on how providers separate the
 * two: this is "stop using it here" — history kept, reversible with Reconnect
 * — while deleting the number from WhatsApp is done in Meta's WhatsApp
 * Manager and can't be undone. Typed confirmation, because a mis-click here
 * stops a live number.
 */
export function DisconnectNumberDialog({
  open,
  onOpenChange,
  accountId,
  phoneNumberId,
  label,
  phoneNumber,
  onDisconnected,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  phoneNumberId: string
  label: string
  phoneNumber: string | null
  onDisconnected: () => void
}) {
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const expected = disconnectConfirmation(phoneNumber)
  const matches = confirmationMatches(typed, expected)

  const reset = () => {
    setTyped("")
    setError(null)
  }

  const disconnect = async () => {
    setBusy(true)
    setError(null)
    try {
      await disconnectWhatsappPhone(accountId, phoneNumberId)
      reset()
      onDisconnected()
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't disconnect this number. Please try again."))
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
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive-soft text-destructive">
              <Unplug className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">Disconnect {label}?</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                This number stops sending and receiving messages here. You can reconnect it any time.
              </DialogDescription>
            </div>
          </div>

          <ul className="space-y-2 rounded-lg bg-muted/60 p-4 text-sm">
            <li>• Chats, contacts and reports stay — nothing is deleted.</li>
            <li>• It disappears from the sender lists in campaigns, drips and the inbox.</li>
            <li>• Another workspace can connect it afterwards.</li>
            <li>• Nothing changes at Meta: the number stays registered on WhatsApp.</li>
          </ul>

          <div className="space-y-2">
            <Label htmlFor="disconnect-confirm">
              Type <span className="font-mono font-semibold">{expected}</span> to confirm
            </Label>
            <Input
              id="disconnect-confirm"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={expected}
            />
          </div>

          {error ? <StatusNote tone="error">{error}</StatusNote> : null}

          <p className="text-xs text-muted-foreground">
            Want the number off WhatsApp entirely, for example to use it in the WhatsApp app again? Delete it in{" "}
            <a
              href={WHATSAPP_MANAGER_NUMBERS}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline"
            >
              Meta&apos;s WhatsApp Manager <ExternalLink className="h-3 w-3" />
            </a>{" "}
            — that can&apos;t be undone.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!matches || busy} onClick={disconnect}>
            {busy ? <Busy>Disconnecting…</Busy> : "Disconnect number"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
