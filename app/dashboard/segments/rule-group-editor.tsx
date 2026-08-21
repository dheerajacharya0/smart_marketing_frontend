"use client"

import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Explain } from "@/components/explain"
import type { GlossaryTerm } from "@/lib/glossary"
import { cn } from "@/lib/utils"
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

/**
 * Condition types that have a glossary entry. "Tag" and "Contact field" are
 * ordinary English and explaining them would be noise; the other three are
 * the ones a first-time user has no way to guess the meaning of.
 */
const TYPE_TERMS: Partial<Record<ConditionDraft["type"], GlossaryTerm>> = {
  attribute: "attribute",
  activity: "activity",
  campaign: "campaign-behavior",
}

/**
 * Small connecting words between the controls.
 *
 * The row is a sentence — "Tag / has tag / vip" — but three dropdowns in a
 * line read as a form, not as a sentence, and the user has to reconstruct the
 * meaning from the widget order. These are the words that were always implied.
 */
function Connective({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 text-sm text-muted-foreground">{children}</span>
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
  // `attributeKeys` is not read here: the attribute input is backed by a
  // <datalist> the builder renders once, rather than one per condition row.
  const { knownTags, campaigns } = options

  const term = TYPE_TERMS[draft.type]

  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle bg-surface-2/50 p-3 space-y-2",
        error && "border-destructive/40 bg-destructive-soft/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <span className="inline-flex items-center gap-1">
          <Select value={draft.type} onValueChange={(v) => onChange({ type: v as ConditionDraft["type"] })}>
            <SelectTrigger className="h-9 w-44">
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
          {term && <Explain term={term} />}
        </span>

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
          <>
            <Connective>named</Connective>
            <Input
              value={draft.key}
              onChange={(e) => onChange({ key: e.target.value })}
              placeholder="e.g. city"
              list="segment-attr-keys"
              className="h-9 w-36"
            />
          </>
        )}

        {draft.type === "campaign" && (
          <Select value={draft.event} onValueChange={(v) => onChange({ event: v as ConditionDraft["event"] })}>
            <SelectTrigger className="h-9 w-44">
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
          <SelectTrigger className="h-9 w-40">
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
              className="h-9 w-20"
            />
            <Connective>days</Connective>
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

        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto shrink-0"
          aria-label="Remove this condition"
          disabled={!canRemove}
          onClick={onRemove}
        >
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
    <div
      className={
        isRoot
          ? "space-y-2"
          : "space-y-2 rounded-lg border border-dashed border-border bg-surface/40 p-3"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* "Match all of" reads as an instruction; ALL/AND read as a setting.
            Same control, stated as the sentence it governs. */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">A contact must match</span>
          <Tabs
            value={group.combinator}
            onValueChange={(v) => onChange({ ...group, combinator: v as "and" | "or" })}
          >
            <TabsList className="h-8">
              <TabsTrigger value="and" className="text-xs">
                all of these
              </TabsTrigger>
              <TabsTrigger value="or" className="text-xs">
                any of these
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <X className="mr-2 h-3.5 w-3.5" /> Remove group
          </Button>
        )}
      </div>

      {group.conditions.map((node, index) => (
        <div key={index}>
          {/* The joining word, spelled out between the rows it joins. It is
              the group's own combinator, so it stays in step with the control
              above without being a second place to set it. */}
          {index > 0 && (
            <div className="flex items-center gap-2 py-1.5">
              <span className="rounded-full border border-border-subtle bg-surface px-2 py-0.5 text-[11px] font-medium uppercase tracking-label text-muted-foreground">
                {group.combinator}
              </span>
              <span aria-hidden className="h-px flex-1 bg-border-subtle" />
            </div>
          )}
          {isGroupDraft(node) ? (
            <RuleGroupEditor
              group={node}
              onChange={(next) => replaceAt(index, next)}
              options={options}
              depth={depth + 1}
              onRemove={() => removeAt(index)}
            />
          ) : (
            <ConditionRow
              draft={node}
              onChange={(patch) => replaceAt(index, normalizeOperator({ ...node, ...patch }))}
              onRemove={() => removeAt(index)}
              // The root must keep at least one row; a nested group can be
              // emptied out, which is how you delete it row by row.
              canRemove={!isRoot || group.conditions.length > 1}
              options={options}
              error={conditionError(node)}
            />
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 pt-1">
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
