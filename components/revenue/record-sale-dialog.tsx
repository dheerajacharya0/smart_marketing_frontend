"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import toast from "react-hot-toast"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getErrorMessage } from "@/lib/errors"
import { recordConversion } from "@/services/api"

/**
 * Report one sale by hand.
 *
 * Revenue could only ever arrive from a store or CRM calling the API, so an
 * account without an integration saw an empty page and no way to fill it —
 * the whole attribution feature was unreachable to anyone who hadn't written
 * code against it. Most small businesses know a sale happened and can type a
 * phone number and an amount; that is all the endpoint needs.
 *
 * Deliberately thin. Attribution is the backend's job — last touch inside its
 * window, with the model stored on the row so revenue reported under one rule
 * isn't restated when the rule changes — so this collects facts and never
 * guesses which campaign gets the credit.
 *
 * Currency is not offered. The account bills in exactly one, a mismatch is
 * rejected rather than converted, and a currency picker here would only let
 * someone submit a sale that fails validation.
 */
export function RecordSaleDialog({
  open,
  onOpenChange,
  accountId,
  currency,
  onRecorded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  /** The account's billing currency, shown so the amount isn't ambiguous. */
  currency?: string | null
  onRecorded: () => void
}) {
  const [waId, setWaId] = useState("")
  const [value, setValue] = useState("")
  const [externalId, setExternalId] = useState("")
  const [occurredAt, setOccurredAt] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setWaId("")
      setValue("")
      setExternalId("")
      setOccurredAt("")
      setError(null)
    }
  }, [open])

  const amount = Number(value)
  const amountValid = value.trim() !== "" && Number.isFinite(amount) && amount > 0
  const phoneValid = /\d/.test(waId)
  const canSave = amountValid && phoneValid && !saving

  const submit = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await recordConversion({
        accountId,
        waId: waId.trim(),
        value: amount,
        // Only send what was filled in — an empty string is not a valid
        // external id or date, and the DTO rejects both.
        ...(externalId.trim() ? { externalId: externalId.trim() } : {}),
        ...(occurredAt ? { occurredAt: new Date(occurredAt).toISOString() } : {}),
      })
      toast.success("Sale recorded")
      onRecorded()
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err) || "Couldn't record the sale")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record a sale</DialogTitle>
          <DialogDescription>
            Ties an order to the person who bought it, so the campaign that reached them gets the
            credit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="sale-phone">Customer&apos;s WhatsApp number</Label>
            <Input
              id="sale-phone"
              value={waId}
              onChange={(e) => setWaId(e.target.value)}
              placeholder="+91 90000 00000"
              inputMode="tel"
            />
            <p className="text-xs text-muted-foreground">
              Spaces, dashes and a leading + are fine.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sale-value">
              Order total{currency ? ` (${currency})` : ""}
            </Label>
            <Input
              id="sale-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="499.50"
              inputMode="decimal"
            />
            <p className="text-xs text-muted-foreground">
              The full amount, as you&apos;d write it on a receipt.
              {currency ? " Your account bills in this currency, so sales are recorded in it too." : ""}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sale-order">Order number (optional)</Label>
            <Input
              id="sale-order"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="ORD-1041"
            />
            {/* The backend treats externalId as an idempotency key, which is
                worth spelling out — it is the difference between a safe
                second attempt and double-counted revenue. */}
            <p className="text-xs text-muted-foreground">
              Your own reference. Recording the same order number twice won&apos;t count it twice.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sale-when">When it happened (optional)</Label>
            <Input
              id="sale-when"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank for now. Attribution looks at what reached them before this moment.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSave}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
