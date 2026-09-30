"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Pencil, Tag, Trash2, X } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/empty-state"
import { getErrorMessage } from "@/lib/errors"
import { normalizeTag } from "@/lib/tags"
import { deleteContactTag, renameContactTag, type ContactTag } from "@/services/api"

type Editing = { tag: string; action: "rename"; value: string } | { tag: string; action: "delete" }

/**
 * Every tag on the account with how many contacts carry it, and the two
 * account-wide edits a free-text tag needs: rename (or merge, when the new
 * name already exists) and delete.
 *
 * There is no "create" here on purpose: a tag exists as soon as one contact
 * carries it, so it is made wherever it is first used — a contact, an import,
 * a bulk tag, or a campaign's labels.
 */
export function ManageTagsDialog({
  open,
  onOpenChange,
  accountId,
  tags,
  onChanged,
  onShowContacts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  tags: ContactTag[]
  onChanged: () => void
  /** Filter the Contacts list to one tag. */
  onShowContacts: (tag: string) => void
}) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) setEditing(null)
  }, [open])

  const renameTarget = editing?.action === "rename" ? normalizeTag(editing.value) : ""
  const mergesInto = renameTarget && renameTarget !== editing?.tag && tags.some((t) => t.tag === renameTarget)

  const run = async () => {
    if (!editing) return
    setBusy(true)
    try {
      if (editing.action === "rename") {
        if (!renameTarget || renameTarget === editing.tag) {
          setEditing(null)
          return
        }
        const { updated } = await renameContactTag(accountId, editing.tag, renameTarget)
        toast.success(
          `${mergesInto ? "Merged" : "Renamed"} “${editing.tag}” ${mergesInto ? "into" : "to"} “${renameTarget}” on ${updated} contact${updated === 1 ? "" : "s"}`
        )
      } else {
        const { updated } = await deleteContactTag(accountId, editing.tag)
        toast.success(`Removed “${editing.tag}” from ${updated} contact${updated === 1 ? "" : "s"}`)
      }
      setEditing(null)
      onChanged()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Couldn't change the tag")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tags</DialogTitle>
          <DialogDescription>
            Rename or delete a tag on every contact at once. Segments, drips and automations that use a tag
            by name aren&apos;t updated — check them after renaming.
          </DialogDescription>
        </DialogHeader>

        {tags.length === 0 ? (
          <EmptyState
            plain
            icon={Tag}
            title="No tags yet"
            description="Tags appear here once a contact has one — add them on a contact, in a CSV import, with “Tag these” on a filtered list, or as a campaign's labels."
          />
        ) : (
          <ul className="divide-y rounded-md border">
            {tags.map((t) => {
              const mine = editing?.tag === t.tag ? editing : null
              return (
                <li key={t.tag} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  {mine?.action === "rename" ? (
                    <div className="flex w-full flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Input
                          autoFocus
                          value={mine.value}
                          onChange={(e) => setEditing({ ...mine, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") run()
                            if (e.key === "Escape") setEditing(null)
                          }}
                          maxLength={100}
                          className="h-8"
                          aria-label={`New name for ${t.tag}`}
                        />
                        <Button size="sm" onClick={run} disabled={busy || !renameTarget}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          <span className="sr-only">Save</span>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                          <X className="h-4 w-4" />
                          <span className="sr-only">Cancel</span>
                        </Button>
                      </div>
                      {mergesInto && (
                        <p className="text-xs text-muted-foreground">
                          “{renameTarget}” already exists — the two will be merged into one.
                        </p>
                      )}
                    </div>
                  ) : mine?.action === "delete" ? (
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <span>
                        Remove <span className="font-medium">“{t.tag}”</span> from {t.count} contact
                        {t.count === 1 ? "" : "s"}?
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={run} disabled={busy}>
                          {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                          Remove
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onShowContacts(t.tag)}
                        className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
                        title="Show these contacts"
                      >
                        {t.tag}
                      </button>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {t.count.toLocaleString()} contact{t.count === 1 ? "" : "s"}
                        {t.optedInCount < t.count && ` · ${t.optedInCount.toLocaleString()} opted in`}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => setEditing({ tag: t.tag, action: "rename", value: t.tag })}
                        disabled={!!editing}
                        aria-label={`Rename ${t.tag}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => setEditing({ tag: t.tag, action: "delete" })}
                        disabled={!!editing}
                        aria-label={`Delete ${t.tag}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
