"use client"

import { useState } from "react"
import { Loader2, Phone } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { dial } from "@/lib/call-dialer"
import { getErrorMessage, getErrorStatus } from "@/lib/errors"
import { formatDateTime } from "@/lib/format-date"
import {
  getCallPermission,
  requestCallPermission,
  type CallPermission,
} from "@/services/api"

interface CallButtonProps {
  accountId: string | null | undefined
  phoneNumberId: string | null | undefined
  customerWaId: string
  customerName?: string | null
  conversationId?: string | null
  /** `icon` for a header, `label` for a row action ("Call back"). */
  variant?: "icon" | "label"
  label?: string
  className?: string
}

/**
 * Call a customer on WhatsApp — or, when they haven't allowed calls from the
 * business, offer to ask them.
 *
 * Permission is checked with Meta on every click rather than remembered: a
 * customer can revoke it from the business profile at any time, and four
 * unanswered calls revoke it automatically, so a cached "yes" is exactly the
 * one that fails.
 */
export function CallButton({
  accountId,
  phoneNumberId,
  customerWaId,
  customerName,
  conversationId,
  variant = "icon",
  label = "Call",
  className,
}: CallButtonProps) {
  const [checking, setChecking] = useState(false)
  const [blocked, setBlocked] = useState<CallPermission | null>(null)
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const name = customerName?.trim() || `+${customerWaId}`

  const onClick = async () => {
    if (!accountId || !phoneNumberId || checking) return
    setChecking(true)
    try {
      const permission = await getCallPermission(accountId, phoneNumberId, customerWaId)
      if (permission.canCall) {
        dial({ phoneNumberId, customerWaId, customerName, conversationId })
      } else {
        setBlocked(permission)
      }
    } catch (err) {
      if (getErrorStatus(err) === 403) {
        toast.error("Only teammates who can see every conversation can make calls")
      } else {
        toast.error(getErrorMessage(err, "Couldn't check whether this customer can be called"))
      }
    } finally {
      setChecking(false)
    }
  }

  const sendRequest = async () => {
    if (!accountId || !phoneNumberId) return
    setSending(true)
    try {
      await requestCallPermission({
        accountId,
        phoneNumberId,
        customerWaId,
        bodyText: note.trim() || undefined,
      })
      toast.success(`Asked ${name} to allow calls — their answer shows up in the chat`)
      setBlocked(null)
      setNote("")
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't send the request"))
    } finally {
      setSending(false)
    }
  }

  // Granted, but Meta still won't place it (too many calls to them today).
  const grantedButLimited = blocked !== null && blocked.status !== "no_permission"

  const icon = checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Phone className="h-5 w-5" />

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="ghost"
          size="icon"
          title={`WhatsApp call ${name}`}
          aria-label={`WhatsApp call ${name}`}
          disabled={!accountId || !phoneNumberId || checking}
          onClick={() => void onClick()}
          className={className}
        >
          {icon}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={!accountId || !phoneNumberId || checking}
          onClick={() => void onClick()}
          className={cn("gap-1.5", className)}
        >
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
          {label}
        </Button>
      )}

      <Dialog open={blocked !== null} onOpenChange={(open) => !open && setBlocked(null)}>
        <DialogContent className="sm:max-w-md">
          {grantedButLimited ? (
            <>
              <DialogHeader>
                <DialogTitle>Can&apos;t call {name} right now</DialogTitle>
                <DialogDescription>
                  {name} allows calls from your business, but WhatsApp isn&apos;t letting another one through
                  yet — it limits how many calls a business can make to one person in a day. Try again
                  later, or send them a message.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setBlocked(null)}>OK</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Ask {name} to allow calls</DialogTitle>
                <DialogDescription>
                  WhatsApp only lets a business call people who have said yes. {name} gets a message with
                  Allow and Decline; once they allow, this button rings them.
                </DialogDescription>
              </DialogHeader>

              {blocked?.canRequest ? (
                <div className="space-y-2">
                  <label htmlFor="call-request-note" className="text-sm font-medium">
                    Why you&apos;d like to call <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Textarea
                    id="call-request-note"
                    value={note}
                    maxLength={1024}
                    rows={3}
                    placeholder="e.g. To go through your order details"
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sent as a normal message, so they need to have messaged you in the last 24 hours. WhatsApp
                    allows one request a day and two a week.
                  </p>
                </div>
              ) : (
                <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                  You&apos;ve already asked recently — WhatsApp allows one request a day and two a week.
                  {blocked?.requestAvailableAt
                    ? ` You can ask again after ${formatDateTime(blocked.requestAvailableAt)}.`
                    : " Try again later."}
                </p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setBlocked(null)}>
                  Cancel
                </Button>
                <Button onClick={() => void sendRequest()} disabled={!blocked?.canRequest || sending}>
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send request
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
