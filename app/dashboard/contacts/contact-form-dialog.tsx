"use client"

import { useEffect, useState } from "react"
import { getErrorMessage, getErrorStatus, getFieldError } from "@/lib/errors"
import { Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneNumberInput } from "@/components/phone-number-input"
import { TagInput } from "@/components/tag-input"
import { addTags, splitTags } from "@/lib/tags"
import { checkRecipient } from "@/lib/phone-number"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "react-hot-toast"
import { createContact, updateContact, type Contact } from "@/services/api"

interface AttributeRow {
  key: string
  value: string
}

export function ContactFormDialog({
  open,
  onOpenChange,
  accountId,
  contact,
  onSaved,
  knownTags = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  contact: Contact | null // null = create mode
  onSaved: () => void
  /** The account's existing tags, suggested as you type. */
  knownTags?: string[]
}) {
  const isEdit = !!contact

  const [phone, setPhone] = useState("")
  const [name, setName] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [attributes, setAttributes] = useState<AttributeRow[]>([])
  const [optedIn, setOptedIn] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // A problem with the number specifically — pinned under that field rather
  // than left in the form-wide line, which is not where the user is looking.
  const [phoneError, setPhoneError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFormError(null)
    setPhoneError(null)
    if (contact) {
      setPhone(contact.waId)
      setName(contact.name || "")
      setTags(contact.tags || [])
      setTagDraft("")
      setAttributes(Object.entries(contact.attributes || {}).map(([key, value]) => ({ key, value })))
      setOptedIn(contact.optedIn)
    } else {
      setPhone("")
      setName("")
      setTags([])
      setTagDraft("")
      setAttributes([])
      setOptedIn(false)
    }
  }, [open, contact])

  const setAttribute = (index: number, field: keyof AttributeRow, value: string) => {
    setAttributes((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const handleSave = async () => {
    setFormError(null)
    setPhoneError(null)

    // The same rule the backend applies, so the form and the API cannot
    // disagree. The digits it hands back are what we submit — never the `+`
    // or spaced form, which would key a second thread for the same person.
    const recipient = checkRecipient(phone)
    if (!isEdit) {
      if (!phone.trim()) {
        setPhoneError("Phone number is required")
        return
      }
      if (!recipient.valid) {
        setPhoneError(recipient.message ?? "Not a valid WhatsApp number.")
        return
      }
    }

    // A tag still being typed counts: Save before Enter must not drop it.
    const allTags = addTags(tags, splitTags(tagDraft))
    const attrs: Record<string, string> = {}
    for (const row of attributes) {
      if (row.key.trim()) attrs[row.key.trim()] = row.value
    }

    setIsSaving(true)
    try {
      if (isEdit && contact) {
        await updateContact(contact.id, {
          accountId,
          name: name.trim(),
          tags: allTags,
          attributes: attrs,
        })
        toast.success("Contact updated")
      } else {
        await createContact({
          accountId,
          waId: recipient.digits, // bare digits — the form Meta echoes as wa_id
          name: name.trim() || undefined,
          tags: allTags,
          attributes: attrs,
          optedIn,
        })
        toast.success("Contact created")
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      // 409 (duplicate phone) and 400 (invalid phone) surface inline on the form
      const waIdError = getFieldError(err, "waId")
      if (waIdError) {
        setPhoneError(waIdError)
      } else if (getErrorStatus(err) === 409 || getErrorStatus(err) === 400) {
        setFormError(getErrorMessage(err))
      } else {
        toast.error(getErrorMessage(err) || "Failed to save contact")
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Contact" : "Add Contact"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update name, tags and attributes. The phone number can't be changed."
              : "Pick the country, then the number as it's dialled locally."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="contact-phone">Phone (WhatsApp number)</Label>
            <PhoneNumberInput
              id="contact-phone"
              value={phone}
              onChange={(digits) => {
                setPhone(digits)
                setPhoneError(null)
              }}
              error={phoneError}
              disabled={isEdit}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact-name">Name</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact-tags">Tags</Label>
            <TagInput
              id="contact-tags"
              value={tags}
              onChange={setTags}
              draft={tagDraft}
              onDraftChange={setTagDraft}
              suggestions={knownTags}
              placeholder="Type a tag, then Enter or comma"
            />
          </div>

          <div className="grid gap-2">
            <Label>Custom Attributes</Label>
            {attributes.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={row.key}
                  onChange={(e) => setAttribute(i, "key", e.target.value)}
                  placeholder="Key (e.g. city)"
                  className="flex-1"
                />
                <Input
                  value={row.value}
                  onChange={(e) => setAttribute(i, "value", e.target.value)}
                  placeholder="Value (e.g. Pune)"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAttributes((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setAttributes((rows) => [...rows, { key: "", value: "" }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add attribute
            </Button>
          </div>

          {!isEdit && (
            <div className="flex items-start gap-2 p-3 border rounded-md">
              <Checkbox
                id="contact-opted-in"
                checked={optedIn}
                onCheckedChange={(v) => setOptedIn(v === true)}
              />
              <div className="grid gap-1">
                <Label htmlFor="contact-opted-in">Opted in</Label>
                <p className="text-xs text-muted-foreground">Only opted-in contacts receive broadcasts.</p>
              </div>
            </div>
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Save Changes" : "Add Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
