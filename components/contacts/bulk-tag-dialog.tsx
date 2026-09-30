"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TagInput } from "@/components/tag-input"
import { getErrorMessage } from "@/lib/errors"
import { addTags, splitTags } from "@/lib/tags"
import { bulkTagContacts, type ContactListFilters } from "@/services/api"

/** One bulk request's limit, matching the backend. */
const MAX_BULK_TAGS = 10

/**
 * Tag (or untag) a group of contacts, creating the tag if it's new. The group
 * is either the rows ticked in the list, or everyone a filtered list shows
 * across every page — in which case the server re-applies the same filters,
 * so the count confirmed here is the set it touches.
 */
export type BulkTagTarget =
  | { kind: "selected"; contactIds: string[] }
  | {
      kind: "filtered"
      filters: Pick<ContactListFilters, "tag" | "search" | "optedIn">
      total: number
      /** How the list is filtered, in words: "opted in, tagged “vip”". */
      scopeLabel: string
    }

export function BulkTagDialog({
  open,
  onOpenChange,
  accountId,
  target,
  knownTags,
  onComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  target: BulkTagTarget
  knownTags: string[]
  onComplete: () => void
}) {
  const matchingTotal = target.kind === "selected" ? target.contactIds.length : target.total
  const [mode, setMode] = useState<"add" | "remove">("add")
  const [tags, setTags] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode("add")
    setTags([])
    setDraft("")
  }, [open])

  const chosen = addTags(tags, splitTags(draft)).slice(0, MAX_BULK_TAGS)
  const people = `${matchingTotal.toLocaleString()} contact${matchingTotal === 1 ? "" : "s"}`

  const apply = async () => {
    if (!chosen.length) return
    setSaving(true)
    try {
      const { updated } = await bulkTagContacts({
        accountId,
        ...(target.kind === "selected" ? { contactIds: target.contactIds } : { filters: target.filters }),
        ...(mode === "add" ? { add: chosen } : { remove: chosen }),
      })
      const skipped = matchingTotal - updated
      toast.success(
        `${mode === "add" ? "Tagged" : "Untagged"} ${updated.toLocaleString()} contact${updated === 1 ? "" : "s"}` +
          (skipped > 0 ? ` (${skipped.toLocaleString()} already ${mode === "add" ? "had" : "didn't have"} it)` : "")
      )
      onOpenChange(false)
      onComplete()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Couldn't update the tags")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tag {people}</DialogTitle>
          <DialogDescription>
            {target.kind === "selected"
              ? "The contacts you ticked. Type a new tag to create it, or pick one you already use."
              : `Everyone in the current list${target.scopeLabel ? ` (${target.scopeLabel})` : ""}, on every page — not only the rows on screen.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "add" | "remove")} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="add" id="bulk-tag-add" />
              <Label htmlFor="bulk-tag-add" className="cursor-pointer">
                Add tags
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="remove" id="bulk-tag-remove" />
              <Label htmlFor="bulk-tag-remove" className="cursor-pointer">
                Remove tags
              </Label>
            </div>
          </RadioGroup>

          <TagInput
            value={tags}
            onChange={setTags}
            draft={draft}
            onDraftChange={setDraft}
            suggestions={knownTags}
            max={MAX_BULK_TAGS}
            placeholder={mode === "add" ? "Type a new or existing tag" : "Pick the tags to remove"}
          />

          <p className="text-xs text-muted-foreground">
            {mode === "add"
              ? "Adding tags here doesn't start tag-triggered drips or automations. To enrol these people in a drip, enrol the tag from the drip."
              : "Only the tags go. The contacts stay, with their other tags."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={saving || !chosen.length || matchingTotal === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "add" ? "Add to" : "Remove from"} {people}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
