"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AutomationTrigger, AutomationTriggerType } from "@/services/api"
import {
  KEYWORDS_MAX,
  NO_REPLY_HOURS_MAX,
  NO_REPLY_HOURS_MIN,
  TAG_MAX,
  TRIGGER_HINTS,
  TRIGGER_LABELS,
  TRIGGER_TYPES,
  defaultTrigger,
} from "@/lib/automation-rules"

/** Comma-separated list → trimmed, de-duplicated, empties dropped. */
function parseList(text: string): string[] {
  const seen = new Set<string>()
  for (const raw of text.split(",")) {
    const value = raw.trim()
    if (value) seen.add(value)
  }
  return [...seen]
}

/**
 * "When should this run?" — one trigger, its own fields.
 *
 * The comma-separated inputs keep their raw text locally: parsing on every
 * keystroke and writing the array back would fight the caret the moment someone
 * types a comma. The parsed array is what leaves the component.
 */
export function RuleTriggerEditor({
  trigger,
  onChange,
  issues,
}: {
  trigger: AutomationTrigger
  onChange: (trigger: AutomationTrigger) => void
  issues: string[]
}) {
  const [listText, setListText] = useState(() =>
    trigger.type === "keyword"
      ? trigger.keywords.join(", ")
      : trigger.type === "button"
        ? trigger.buttonIds.join(", ")
        : ""
  )

  // Re-seed when the dialog switches to a different rule; the parent remounts
  // this on open, so this only fires for a trigger-type change.
  useEffect(() => {
    if (trigger.type === "keyword") setListText(trigger.keywords.join(", "))
    else if (trigger.type === "button") setListText(trigger.buttonIds.join(", "))
    else setListText("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger.type])

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid gap-2">
        <Label>When this happens</Label>
        <Select
          value={trigger.type}
          onValueChange={(v) => onChange(defaultTrigger(v as AutomationTriggerType))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {TRIGGER_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{TRIGGER_HINTS[trigger.type]}</p>
      </div>

      {trigger.type === "keyword" && (
        <>
          <div className="grid gap-2">
            <Label>Match</Label>
            <Select
              value={trigger.matchType}
              onValueChange={(v) =>
                onChange({ ...trigger, matchType: v as typeof trigger.matchType })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Message is exactly a keyword</SelectItem>
                <SelectItem value="contains">Message contains a keyword</SelectItem>
                <SelectItem value="any">Any message (catch-all)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {trigger.matchType === "any" ? (
            <p className="text-xs text-muted-foreground">
              This replies to every message. Only the first matching rule fires, so give it a high
              priority number to keep it as the last resort.
            </p>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="trigger-keywords">Keywords (comma separated)</Label>
              <Input
                id="trigger-keywords"
                value={listText}
                onChange={(e) => {
                  setListText(e.target.value)
                  onChange({ ...trigger, keywords: parseList(e.target.value) })
                }}
                placeholder="hi, hello, hours"
              />
              <p className="text-xs text-muted-foreground">
                Case-insensitive. Up to {KEYWORDS_MAX}.
              </p>
            </div>
          )}
        </>
      )}

      {trigger.type === "button" && (
        <div className="grid gap-2">
          <Label htmlFor="trigger-buttons">Button ids (comma separated, optional)</Label>
          <Input
            id="trigger-buttons"
            value={listText}
            onChange={(e) => {
              setListText(e.target.value)
              onChange({ ...trigger, buttonIds: parseList(e.target.value) })
            }}
            placeholder="Leave empty for any button"
          />
          <p className="text-xs text-muted-foreground">
            The id you gave the button when you built the message, not its label.
          </p>
        </div>
      )}

      {trigger.type === "tag_added" && (
        <div className="grid gap-2">
          <Label htmlFor="trigger-tag">Tag</Label>
          <Input
            id="trigger-tag"
            value={trigger.tag}
            maxLength={TAG_MAX}
            onChange={(e) => onChange({ ...trigger, tag: e.target.value })}
            placeholder="vip"
          />
        </div>
      )}

      {trigger.type === "no_reply" && (
        <div className="grid gap-2">
          <Label htmlFor="trigger-hours">Hours of silence</Label>
          <Input
            id="trigger-hours"
            type="number"
            min={NO_REPLY_HOURS_MIN}
            max={NO_REPLY_HOURS_MAX}
            value={trigger.hours}
            onChange={(e) => onChange({ ...trigger, hours: Math.trunc(Number(e.target.value)) })}
          />
          <p className="text-xs text-muted-foreground">
            Counted from your last message. Past 24 hours only an approved template can be sent, so
            a text action will fail — use a template action for long waits.
          </p>
        </div>
      )}

      {issues.map((message) => (
        <p key={message} className="text-xs text-destructive">
          {message}
        </p>
      ))}
    </div>
  )
}
