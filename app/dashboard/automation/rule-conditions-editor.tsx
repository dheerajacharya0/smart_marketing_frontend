"use client"

import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AutomationCondition, AutomationConditions } from "@/services/api"
import {
  CONDITIONS_MAX,
  CONDITION_LABELS,
  CONDITION_TYPES,
  attributeOperatorTakesValue,
  defaultCondition,
  type AutomationConditionType,
  type RuleIssue,
} from "@/lib/automation-rules"

type AttributeOperator = Extract<AutomationCondition, { type: "attribute" }>["operator"]
type TextOperator = Extract<AutomationCondition, { type: "text" }>["operator"]
type TagOperator = Extract<AutomationCondition, { type: "tag" }>["operator"]

/**
 * "Only when…" — optional filters on the contact and the triggering message.
 *
 * Narrower than segment rules on purpose: these run in memory on every matching
 * event, so anything needing history ("messaged in the last 30 days") belongs in
 * a segment instead. `null` conditions means "always", which is why removing the
 * last row removes the whole group rather than leaving an empty one — the server
 * rejects an empty condition list.
 *
 * Suggestion datalists (`automation-known-tags`, `automation-attribute-keys`)
 * are rendered once by the page, since the actions editor uses the same two.
 */
export function RuleConditionsEditor({
  conditions,
  onChange,
  issues,
}: {
  conditions: AutomationConditions | null
  onChange: (conditions: AutomationConditions | null) => void
  issues: RuleIssue[]
}) {
  const groupIssues = issues.filter((i) => i.index === undefined).map((i) => i.message)
  const rowIssue = (index: number) =>
    issues.find((i) => i.index === index)?.message

  const update = (index: number, condition: AutomationCondition) => {
    if (!conditions) return
    const next = [...conditions.conditions]
    next[index] = condition
    onChange({ ...conditions, conditions: next })
  }

  const remove = (index: number) => {
    if (!conditions) return
    const next = conditions.conditions.filter((_, i) => i !== index)
    onChange(next.length ? { ...conditions, conditions: next } : null)
  }

  if (!conditions) {
    return (
      <div className="rounded-md border border-dashed p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Runs for everyone</p>
            <p className="text-xs text-muted-foreground">
              Add a condition to narrow it — for example only contacts tagged “vip”.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ combinator: "and", conditions: [defaultCondition("tag")] })}
          >
            <Plus className="mr-2 h-3.5 w-3.5" /> Add condition
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <Label>Only when</Label>
        <Select
          value={conditions.combinator}
          onValueChange={(v) => onChange({ ...conditions, combinator: v as "and" | "or" })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">All must match</SelectItem>
            <SelectItem value="or">Any can match</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {conditions.conditions.map((condition, index) => (
        <div key={index} className="space-y-2 rounded-md bg-muted/40 p-2">
          <div className="flex items-start gap-2">
            <Select
              value={condition.type}
              onValueChange={(v) => update(index, defaultCondition(v as AutomationConditionType))}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {CONDITION_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-1 flex-wrap gap-2">
              {condition.type === "tag" && (
                <>
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => update(index, { ...condition, operator: v as TagOperator })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="has">has tag</SelectItem>
                      <SelectItem value="not_has">doesn&apos;t have</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1 min-w-32"
                    list="automation-known-tags"
                    value={condition.value}
                    onChange={(e) => update(index, { ...condition, value: e.target.value })}
                    placeholder="vip"
                  />
                </>
              )}

              {condition.type === "attribute" && (
                <>
                  <Input
                    className="w-36"
                    list="automation-attribute-keys"
                    value={condition.key}
                    onChange={(e) => update(index, { ...condition, key: e.target.value })}
                    placeholder="city"
                  />
                  <Select
                    value={condition.operator}
                    onValueChange={(v) =>
                      update(index, { ...condition, operator: v as AttributeOperator })
                    }
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">is</SelectItem>
                      <SelectItem value="not_equals">is not</SelectItem>
                      <SelectItem value="contains">contains</SelectItem>
                      <SelectItem value="exists">is set</SelectItem>
                      <SelectItem value="not_exists">is not set</SelectItem>
                    </SelectContent>
                  </Select>
                  {attributeOperatorTakesValue(condition.operator) && (
                    <Input
                      className="flex-1 min-w-32"
                      value={condition.value ?? ""}
                      onChange={(e) => update(index, { ...condition, value: e.target.value })}
                      placeholder="Mumbai"
                    />
                  )}
                </>
              )}

              {condition.type === "opted_in" && (
                <Select
                  value={condition.value ? "true" : "false"}
                  onValueChange={(v) => update(index, { ...condition, value: v === "true" })}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">is opted in</SelectItem>
                    <SelectItem value="false">is opted out</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {condition.type === "text" && (
                <>
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => update(index, { ...condition, operator: v as TextOperator })}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">contains</SelectItem>
                      <SelectItem value="equals">is exactly</SelectItem>
                      <SelectItem value="not_contains">doesn&apos;t contain</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1 min-w-32"
                    value={condition.value}
                    onChange={(e) => update(index, { ...condition, value: e.target.value })}
                    placeholder="refund"
                  />
                </>
              )}
            </div>

            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {rowIssue(index) && <p className="text-xs text-destructive">{rowIssue(index)}</p>}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={conditions.conditions.length >= CONDITIONS_MAX}
        onClick={() =>
          onChange({
            ...conditions,
            conditions: [...conditions.conditions, defaultCondition("tag")],
          })
        }
      >
        <Plus className="mr-2 h-3.5 w-3.5" /> Add condition
      </Button>

      {groupIssues.map((message) => (
        <p key={message} className="text-xs text-destructive">
          {message}
        </p>
      ))}
    </div>
  )
}
