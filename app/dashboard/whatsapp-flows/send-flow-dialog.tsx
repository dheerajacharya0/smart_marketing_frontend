"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "react-hot-toast"
import { getErrorMessage } from "@/lib/errors"
import {
  sendWhatsappFlowMessage,
  type WhatsappContext,
  type WhatsappFlow,
} from "@/services/api"

/**
 * Sends a form to one contact.
 *
 * Goes through the flows send route rather than the ordinary message endpoints
 * because the correlation token has to be issued before the send and attached
 * to the message — Meta's submission carries no reference to what triggered it,
 * so a hand-assembled send produces a response nothing can be attributed to.
 */
export function SendFlowDialog({
  open,
  onOpenChange,
  context,
  flow,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: WhatsappContext
  flow: WhatsappFlow
}) {
  const isDraft = flow.status === "DRAFT"
  const [to, setTo] = useState("")
  const [cta, setCta] = useState("Open form")
  const [bodyText, setBodyText] = useState("")
  const [headerText, setHeaderText] = useState("")
  const [footerText, setFooterText] = useState("")
  // A draft can only be delivered to a WABA tester; Meta rejects it otherwise,
  // so this defaults on for a draft rather than making someone discover it.
  const [draft, setDraft] = useState(isDraft)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    setError(null)
    if (!to.trim()) {
      setError("Enter the contact's WhatsApp number")
      return
    }
    if (!bodyText.trim()) {
      setError("Add the message that goes with the form")
      return
    }
    setIsSending(true)
    try {
      await sendWhatsappFlowMessage({
        accountId: context.accountId,
        phoneNumberId: context.phoneNumberId,
        to: to.trim(),
        flowId: flow.id,
        cta: cta.trim() || "Open form",
        bodyText: bodyText.trim(),
        ...(headerText.trim() ? { headerText: headerText.trim() } : {}),
        ...(footerText.trim() ? { footerText: footerText.trim() } : {}),
        ...(draft ? { draft: true } : {}),
      })
      toast.success("Form sent")
      onOpenChange(false)
      setTo("")
      setBodyText("")
    } catch (err) {
      setError(getErrorMessage(err) || "Send failed")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send &ldquo;{flow.name}&rdquo;</DialogTitle>
          <DialogDescription>
            The contact gets a message with a button that opens the form inside WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="send-to">Send to</Label>
            <Input
              id="send-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="919876543210"
            />
            <p className="text-xs text-muted-foreground">
              Country code and number, no plus or spaces.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="send-body">Message</Label>
            <Textarea
              id="send-body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={3}
              placeholder="Book your appointment in a few taps."
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="send-cta">Button label</Label>
              <Input
                id="send-cta"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                maxLength={20}
                placeholder="Open form"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="send-header">Header (optional)</Label>
              <Input
                id="send-header"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                maxLength={60}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="send-footer">Footer (optional)</Label>
            <Input
              id="send-footer"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              maxLength={60}
            />
          </div>

          {isDraft && (
            <div className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Send as a draft</p>
                <p className="text-xs text-muted-foreground">
                  A draft form only reaches people added as testers on your WhatsApp Business
                  Account — Meta rejects the send for anyone else.
                </p>
              </div>
              <Switch checked={draft} onCheckedChange={setDraft} />
            </div>
          )}

          {/* Free-form messages need the 24-hour window open. Worth saying here:
              a flow send that fails on 131047 is otherwise a confusing error. */}
          <p className="text-xs text-muted-foreground">
            This sends as a normal message, so it needs the contact to have messaged you in the
            last 24 hours.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
