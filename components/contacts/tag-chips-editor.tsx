"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { normalizeLabel } from "@/lib/campaign-labels"

/**
 * Picked tags as removable chips, a box to create a new one, and the account's
 * existing tags one tap away. Used for campaign labels and for tagging an
 * upload — both are "which tags go on these people".
 *
 * No popover or dropdown on purpose: inside a dialog those misbehave on touch
 * screens, and plain buttons are as fast with a thumb.
 */
export function TagChipsEditor({
  value,
  onChange,
  knownTags,
  max,
  placeholder = "New tag",
  createLabel = "Add",
  emptyText = "No tags.",
  suggestionLimit = 12,
}: {
  value: string[]
  onChange: (next: string[]) => void
  knownTags: string[]
  max?: number
  placeholder?: string
  createLabel?: string
  emptyText?: string
  suggestionLimit?: number
}) {
  const [draft, setDraft] = useState("")
  const full = max != null && value.length >= max

  const add = (raw: string) => {
    // ";" and "|" separate tags in an import file, so a tag holding one
    // would arrive as two. Same goes for the label path, kept consistent.
    const tag = normalizeLabel(raw).replace(/[;|]+/g, "-")
    if (!tag || value.includes(tag) || full) return
    onChange([...value, tag])
  }

  const commitDraft = () => {
    if (!draft.trim()) return
    add(draft)
    setDraft("")
  }

  const suggestions = knownTags.filter((t) => !value.includes(t)).slice(0, suggestionLimit)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-sm">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="-mr-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {value.length === 0 && <span className="text-sm text-muted-foreground">{emptyText}</span>}
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commitDraft()
            }
          }}
          placeholder={placeholder}
          maxLength={100}
          disabled={full}
          className="min-w-0"
        />
        <Button type="button" variant="outline" onClick={commitDraft} disabled={!draft.trim() || full} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" /> {createLabel}
        </Button>
      </div>
      {full && <p className="text-xs text-muted-foreground">Up to {max}.</p>}

      {!full && suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Or reuse an existing tag</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((tag) => (
              <Button
                key={tag}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => add(tag)}
              >
                <Plus className="mr-1 h-3 w-3" />
                {tag}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
