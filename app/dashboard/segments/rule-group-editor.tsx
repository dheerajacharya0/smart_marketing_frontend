"use client"

import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Campaign } from "@/services/api"
import {
  CAMPAIGN_EVENT_OPTIONS,
  CONDITION_TYPE_OPTIONS,
  FIELD_OPTIONS,
  MAX_CONDITIONS,
  MAX_GROUP_DEPTH,
  conditionError,
  conditionNeedsValue,
  emptyCondition,
  emptyGroup,
  isGroupDraft,
  normalizeOperator,
  operatorOptionsFor,
  type ConditionDraft,
  type GroupDraft,
} from "@/lib/segment-rules"

export interface RuleEditorOptions {
  attributeKeys: string[]
  knownTags: string[]
  campaigns: Campaign[]
}

/** One leaf condition. Extracted from the builder so a group can render it at any depth. */
function ConditionRow({
  draft,
  onChange,
  onRemove,
  canRemove,
  options,
  error,
}: {
  draft: ConditionDraft
  onChange: (patch: Partial<ConditionDraft>) => void
  onRemove: () => void
  canRemove: boolean
  options: RuleEditorOptions
  error: string | null
}) {
  const { attributeKeys, knownTags, campaigns } = options

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={draft.type} onValueChange={(v) => onChange({ type: v as ConditionDraft["type"] })}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {draft.type === "field" && (
          <Select
            value={draft.field}
            onValueChange={(v) => onChange({ field: v as ConditionDraft["field"], value: "" })}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {draft.type === "attribute" && (
          <Input
            value={draft.key}
            onChange={(e) => onChange({ key: e.target.value })}
            placeholder="key (e.g. city)"
            list="segment-attr-keys"
            className="w-36 h-9"
          />
        )}

        {draft.type === "campaign" && (
          <Select value={draft.event} onValueChange={(v) => onChange({ event: v as ConditionDraft["event"] })}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_EVENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={draft.operator} onValueChange={(v) => onChange({ operator: v })}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operatorOptionsFor(draft).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {draft.type === "field" && conditionNeedsValue(draft) && (
          <Input
            type={draft.field === "createdAt" ? "date" : "text"}
            value={draft.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="value"
            className="w-44 h-9"
          />
        )}

        {draft.type === "attribute" && conditionNeedsValue(draft) && (
          <Input
            value={draft.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="value"
            className="w-40 h-9"
          />
        )}

        {draft.type === "tag" &&
          (knownTags.length > 0 ? (
            <Select value={draft.value} onValueChange={(v) => onChange({ value: v })}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Select tag" />
              </SelectTrigger>
              <SelectContent>
                {knownTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={draft.value}
              onChange={(e) => onChange({ value: e.target.value.toLowerCase() })}
              placeholder="tag"
              className="w-40 h-9"
            />
          ))}

        {(draft.type === "activity" || draft.type === "campaign") && (
          <span className="flex items-center gap-1.5">
            <Input
              type="number"
              min={1}
              max={365}
              value={draft.days}
              onChange={(e) => onChange({ days: e.target.value })}
              className="w-20 h-9"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </span>
        )}

        {draft.type === "campaign" && (
          <Select
            value={draft.campaignId || "any"}
            onValueChange={(v) => onChange({ campaignId: v === "any" ? "" : v })}
          >
            <SelectTrigger className="w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any campaign</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button variant="ghost" size="sm" className="ml-auto" disabled={!canRemove} onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {draft.type === "campaign" && draft.event === "clicked" && (
        <p className="text-xs text-muted-foreground">
          Only matches campaigns that tracked their links — one that didn&apos;t simply matches
          nobody.
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/**
 * A group of conditions, nestable.
 *
 * Nesting is what makes "(A and B) or C" expressible — a single flat combinator
 * can only say all-of or any-of, and every audience that needs both was
 * previously impossible to describe without building several segments.
 *
 * The depth cap mirrors the server's: past it the rules compile to SQL Postgres
 * plans badly, which surfaces as a preview that hangs rather than an error.
 */
export function RuleGroupEditor({
  group,
  onChange,
  options,
  depth = 1,
  onRemove,
  serverError,
}: {
  group: GroupDraft
  onChange: (group: GroupDraft) => void
  options: RuleEditorOptions
  depth?: number
  /** Absent on the root, which can't be removed. */
  onRemove?: () => void
  /** Server-reported problem, shown on the root only. */
  serverError?: string | null
}) {
  const isRoot = depth === 1

  const replaceAt = (index: number, node: ConditionDraft | GroupDraft) => {
    onChange({ ...group, conditions: group.conditions.map((c, i) => (i === index ? node : c)) })
  }

  const removeAt = (index: number) => {
    onChange({ ...group, conditions: group.conditions.filter((_, i) => i !== index) })
  }

  return (
    <div className={isRoot ? "space-y-3" : "space-y-3 rounded-md border border-dashed p-3"}>
      <div className="flex items-center justify-between gap-3">
        <Tabs
          value={group.combinator}
          onValueChange={(v) => onChange({ ...group, combinator: v as "and" | "or" })}
        >
          <TabsList>
            <TabsTrigger value="and">Match ALL (AND)</TabsTrigger>
            <TabsTrigger value="or">Match ANY (OR)</TabsTrigger>
          </TabsList>
        </Tabs>
        {onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <X className="mr-2 h-3.5 w-3.5" /> Remove group
          </Button>
        )}
      </div>

      {group.conditions.map((node, index) =>
        isGroupDraft(node) ? (
          <RuleGroupEditor
            key={index}
            group={node}
            onChange={(next) => replaceAt(index, next)}
            options={options}
            depth={depth + 1}
            onRemove={() => removeAt(index)}
          />
        ) : (
          <ConditionRow
            key={index}
            draft={node}
            onChange={(patch) => replaceAt(index, normalizeOperator({ ...node, ...patch }))}
            onRemove={() => removeAt(index)}
            // The root must keep at least one row; a nested group can be
            // emptied out, which is how you delete it row by row.
            canRemove={!isRoot || group.conditions.length > 1}
            options={options}
            error={conditionError(node)}
          />
        )
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={group.conditions.length >= MAX_CONDITIONS}
          onClick={() => onChange({ ...group, conditions: [...group.conditions, emptyCondition()] })}
        >
          <Plus className="mr-2 h-4 w-4" /> Add condition
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={group.conditions.length >= MAX_CONDITIONS || depth >= MAX_GROUP_DEPTH}
          onClick={() => onChange({ ...group, conditions: [...group.conditions, emptyGroup()] })}
          title={
            depth >= MAX_GROUP_DEPTH
              ? `Groups can nest ${MAX_GROUP_DEPTH} levels deep`
              : "A nested group gets its own AND/OR"
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Add group
        </Button>
        {isRoot && (
          <span className="text-xs text-muted-foreground">
            A group has its own AND/OR — that&apos;s how “(A and B) or C” is built.
          </span>
        )}
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
    </div>
  )
}
