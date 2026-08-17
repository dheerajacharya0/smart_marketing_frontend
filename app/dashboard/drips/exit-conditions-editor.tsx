"use client"

import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { DripExitCondition } from "@/services/api"

type ExitConditionType = DripExitCondition["type"]

const MAX_CONDITIONS = 10

const LABELS: Record<ExitConditionType, string> = {
  reply: "They reply",
  button_click: "They tap a button",
  tag_added: "A tag is added",
  tag_removed: "A tag is removed",
}

function defaultCondition(type: ExitConditionType): DripExitCondition {
  switch (type) {
    case "reply":
      return { type: "reply" }
    case "button_click":
      return { type: "button_click" }
    case "tag_added":
      return { type: "tag_added", tag: "" }
    case "tag_removed":
      return { type: "tag_removed", tag: "" }
  }
}

/**
 * When to stop a sequence early.
 *
 * Empty is a real choice, not an unfinished one — some sequences (a 3-part
 * onboarding, say) are meant to run to the end regardless. But without any of
 * these, a nurture sequence keeps sending on schedule to someone who already
 * answered, which reads as a bot that isn't listening and bills for every step.
 */
export function ExitConditionsEditor({
  conditions,
  onChange,
  knownTags,
}: {
  conditions: DripExitCondition[]
  onChange: (conditions: DripExitCondition[]) => void
  knownTags: string[]
}) {
  const update = (index: number, condition: DripExitCondition) => {
    onChange(conditions.map((c, i) => (i === index ? condition : c)))
  }

  const remove = (index: number) => onChange(conditions.filter((_, i) => i !== index))

  return (
    <div className="space-y-3">
      <div>
        <Label>Stop the sequence early when…</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          {conditions.length === 0
            ? "Nothing stops it — every step sends on schedule, even after the contact replies."
            : "The remaining steps are cancelled as soon as one of these happens."}
        </p>
      </div>

      {conditions.map((condition, index) => (
        <div key={index} className="flex items-start gap-2 rounded-md bg-muted/40 p-2">
          <Select
            value={condition.type}
            onValueChange={(v) => update(index, defaultCondition(v as ExitConditionType))}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LABELS) as ExitConditionType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1">
            {condition.type === "button_click" && (
              <Input
                value={condition.buttonId ?? ""}
                onChange={(e) =>
                  update(index, {
                    type: "button_click",
                    // Empty means any button, which is a different rule from a
                    // button literally called "" — so drop the key entirely.
                    ...(e.target.value.trim() ? { buttonId: e.target.value.trim() } : {}),
                  })
                }
                placeholder="Any button (or a specific button id)"
              />
            )}
            {(condition.type === "tag_added" || condition.type === "tag_removed") && (
              <Input
                list="drip-known-tags"
                value={condition.tag}
                onChange={(e) => update(index, { type: condition.type, tag: e.target.value })}
                placeholder="vip"
              />
            )}
            {condition.type === "reply" && (
              <p className="pt-2 text-xs text-muted-foreground">
                Any inbound message from them counts.
              </p>
            )}
          </div>

          <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <datalist id="drip-known-tags">
        {knownTags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={conditions.length >= MAX_CONDITIONS}
        onClick={() => onChange([...conditions, defaultCondition("reply")])}
      >
        <Plus className="mr-2 h-3.5 w-3.5" /> Add a stop condition
      </Button>
    </div>
  )
}
