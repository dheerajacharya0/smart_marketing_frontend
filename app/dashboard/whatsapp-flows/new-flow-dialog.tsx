"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { getErrorMessage } from "@/lib/errors"
import { createWhatsappFlow, type WhatsappContext } from "@/services/api"

/**
 * Meta's own categories. Sent as given rather than validated against this list —
 * Meta adds categories without notice, and rejecting an unknown one here would
 * block a form Meta would have accepted.
 */
const CATEGORIES = [
  { value: "SIGN_UP", label: "Sign up" },
  { value: "SIGN_IN", label: "Sign in" },
  { value: "APPOINTMENT_BOOKING", label: "Appointment booking" },
  { value: "LEAD_GENERATION", label: "Lead generation" },
  { value: "CONTACT_US", label: "Contact us" },
  { value: "CUSTOMER_SUPPORT", label: "Customer support" },
  { value: "SURVEY", label: "Survey" },
  { value: "OTHER", label: "Other" },
]

export function NewFlowDialog({
  open,
  onOpenChange,
  context,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: WhatsappContext
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [categories, setCategories] = useState<string[]>(["LEAD_GENERATION"])
  const [definitionText, setDefinitionText] = useState("")
  const [endpointUrl, setEndpointUrl] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName("")
    setCategories(["LEAD_GENERATION"])
    setDefinitionText("")
    setEndpointUrl("")
    setError(null)
  }

  const toggleCategory = (value: string) => {
    setCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    )
  }

  const handleCreate = async () => {
    setError(null)
    if (!name.trim()) {
      setError("Give the form a name")
      return
    }
    if (categories.length === 0) {
      setError("Pick at least one category")
      return
    }

    // The design is Meta's Flow JSON. Parsing it here means a typo is caught
    // before a round trip, and the message says *where* — Meta's own error for
    // malformed JSON names neither the field nor the position.
    let definition: Record<string, unknown> | undefined
    if (definitionText.trim()) {
      try {
        definition = JSON.parse(definitionText)
      } catch (err) {
        setError(`That JSON doesn't parse: ${(err as Error).message}`)
        return
      }
    }

    setIsSaving(true)
    try {
      await createWhatsappFlow({
        accountId: context.accountId,
        wabaId: context.wabaId,
        name: name.trim(),
        categories,
        ...(definition ? { definition } : {}),
        ...(endpointUrl.trim() ? { endpointUrl: endpointUrl.trim() } : {}),
      })
      toast.success("Form created as a draft")
      onOpenChange(false)
      reset()
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err) || "Meta rejected this form")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New WhatsApp form</DialogTitle>
          <DialogDescription>
            Created as a draft. You can replace the design as often as you like until you publish
            it — after that Meta freezes it for good.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="flow-name">Name</Label>
            <Input
              id="flow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Appointment booking"
            />
            <p className="text-xs text-muted-foreground">
              For your reference and Meta&apos;s — the contact never sees it.
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Categories</Label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((category) => (
                <label
                  key={category.value}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={categories.includes(category.value)}
                    onCheckedChange={() => toggleCategory(category.value)}
                  />
                  {category.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              How Meta classifies the form. Pick what it actually does — this affects review.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="flow-definition">Design (Flow JSON, optional)</Label>
            <Textarea
              id="flow-definition"
              value={definitionText}
              onChange={(e) => setDefinitionText(e.target.value)}
              rows={8}
              placeholder='{"version": "7.0", "screens": [...]}'
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Meta&apos;s Flow JSON, from their Flow Builder or written by hand. You can leave this
              empty now and upload it from the form&apos;s page later.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="flow-endpoint">Endpoint URL (optional)</Label>
            <Input
              id="flow-endpoint"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://your-server.example/whatsapp-flow"
            />
            <p className="text-xs text-muted-foreground">
              Only for a <code className="rounded bg-muted px-1">data_api</code> form, where Meta
              calls your server for each screen. It needs an encryption key set up on the phone
              number before it will work.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
