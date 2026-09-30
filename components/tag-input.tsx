"use client"

import { useId, useState, type KeyboardEvent } from "react"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { addTags, splitTags, suggestTags } from "@/lib/tags"

/**
 * A box of tags: each one a chip with its own remove button, a comma or Enter
 * to add, and existing tags suggested as you type.
 *
 * Replaces a free-text "comma separated" field, where "follow-up. testing"
 * silently saved as one tag and nothing showed where one tag ended and the
 * next began. The text still being typed is part of the value the parent reads
 * through `draft`, so a Save pressed before Enter doesn't drop it.
 */
export function TagInput({
  id,
  value,
  onChange,
  draft,
  onDraftChange,
  suggestions = [],
  placeholder = "Type a tag, then Enter",
  max,
  className,
}: {
  id?: string
  value: string[]
  onChange: (tags: string[]) => void
  draft: string
  onDraftChange: (text: string) => void
  /** Existing tags on the account, most used first. */
  suggestions?: string[]
  placeholder?: string
  max?: number
  className?: string
}) {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const [focused, setFocused] = useState(false)
  const full = max != null && value.length >= max

  const commit = (text: string) => {
    const incoming = splitTags(text)
    if (!incoming.length) return
    const next = addTags(value, incoming)
    onChange(max != null ? next.slice(0, max) : next)
    onDraftChange("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      commit(draft)
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  const matches = focused && !full ? suggestTags(draft, suggestions, value) : []

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm",
          focused && "ring-2 ring-ring ring-offset-2 ring-offset-background"
        )}
        onClick={() => document.getElementById(inputId)?.focus()}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5">
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(value.filter((t) => t !== tag))
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={draft}
          onChange={(e) => {
            // Pasting "a, b, c" becomes three tags at once.
            const text = e.target.value
            if (/[,;|\n]/.test(text)) commit(text)
            else onDraftChange(text)
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          // Delayed so a click on a suggestion lands before the list closes.
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={full ? `Up to ${max} tags` : value.length ? "" : placeholder}
          disabled={full}
          className="min-w-24 flex-1 bg-transparent py-0.5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>
      {matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {matches.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(tag)}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
