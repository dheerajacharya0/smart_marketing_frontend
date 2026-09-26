"use client"

import { AlertCircle, ChevronDown, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type {
  FlowConditionBranch,
  FlowConditionOperator,
  FlowDefinition,
  FlowNode,
} from "@/services/api"
import {
  formatDelayMinutes,
  operatorTakesValue,
  CONDITION_OPERATOR_OPTIONS,
  MAX_BRANCHES,
  MAX_BUTTONS,
  MAX_DELAY_MINUTES,
} from "@/lib/flow-validation"
import { appendButton } from "@/lib/flow-graph"
import { NODE_TYPE_META } from "./flow-node-meta"

const END_SENTINEL = "__end__"
const NEW_SENTINEL = "__new__"

/**
 * The form for one node, shown in the canvas inspector.
 *
 * Split out of `flow-builder.tsx` when the node list became a canvas: the
 * canvas draws every node, but only the selected one is edited, and the editor
 * is the same regardless of whether it was reached by clicking a card or by
 * arriving from a validation issue.
 */
export function FlowNodeEditor({
  node,
  definition,
  isEntry,
  issues,
  tokens,
  onPatch,
  onRename,
  onRemove,
  onSetEntry,
  onAddNode,
}: {
  node: FlowNode
  definition: FlowDefinition
  isEntry: boolean
  issues: string[]
  tokens: string[]
  onPatch: (id: string, patch: Partial<FlowNode>) => void
  onRename: (oldId: string, newId: string) => void
  onRemove: (id: string) => void
  onSetEntry: (id: string) => void
  /** Adds a node of `type` and returns its id, so "+ create node" can wire straight to it. */
  onAddNode: (type: FlowNode["type"]) => string
}) {
  const patchNode = (patch: Partial<FlowNode>) => onPatch(node.id, patch)

  // Render helpers stay plain functions rather than nested components — a
  // nested component's identity changes every render, remounting inputs and
  // dropping focus mid-keystroke.
  const renderTargetSelect = ({
    value,
    onChange,
    excludeId,
  }: {
    value?: string
    onChange: (target: string | undefined) => void
    excludeId?: string
  }) => (
    <Select
      value={value ?? END_SENTINEL}
      onValueChange={(v) => {
        if (v === NEW_SENTINEL) {
          onChange(onAddNode("message"))
        } else {
          onChange(v === END_SENTINEL ? undefined : v)
        }
      }}
    >
      <SelectTrigger className="h-8 w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={END_SENTINEL}>— end flow —</SelectItem>
        {definition.nodes
          .filter((n) => n.id !== excludeId)
          .map((n) => (
            <SelectItem key={n.id} value={n.id}>
              {n.id}
            </SelectItem>
          ))}
        <SelectItem value={NEW_SENTINEL}>+ create node</SelectItem>
      </SelectContent>
    </Select>
  )

  const renderTokenTextarea = ({
    value,
    onChange,
    required,
  }: {
    value: string
    onChange: (text: string) => void
    required: boolean
  }) => (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Text{required ? "" : " (optional)"}</Label>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${value.length > 1024 ? "text-destructive" : "text-muted-foreground"}`}>
            {value.length}/1024
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                Insert token <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Contact</DropdownMenuLabel>
              {tokens.slice(0, 2).map((t) => (
                <DropdownMenuItem key={t} onClick={() => onChange(value + `{{${t}}}`)}>
                  {`{{${t}}}`}
                </DropdownMenuItem>
              ))}
              {tokens.length > 2 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">Question variables</DropdownMenuLabel>
                  {tokens.slice(2).map((t) => (
                    <DropdownMenuItem key={`${node.id}-${t}`} onClick={() => onChange(value + `{{${t}}}`)}>
                      {`{{${t}}}`}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} />
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`${NODE_TYPE_META[node.type].badgeClass} hover:${NODE_TYPE_META[node.type].badgeClass}`}>
          {NODE_TYPE_META[node.type].label}
        </Badge>
        <Input
          defaultValue={node.id}
          key={node.id}
          onBlur={(e) => onRename(node.id, e.target.value)}
          className="h-8 w-44 font-mono md:text-xs"
          title="Node id — renaming updates everything that points here"
        />
        {isEntry ? (
          <Badge variant="outline" className="border-primary text-primary">
            Entry point
          </Badge>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onSetEntry(node.id)}>
            Set as entry
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-destructive hover:text-destructive"
          onClick={() => onRemove(node.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {(node.type === "message" || node.type === "buttons" || node.type === "question") &&
        renderTokenTextarea({
          value: node.text,
          onChange: (text) => patchNode({ text }),
          required: true,
        })}
      {(node.type === "handoff" || node.type === "end") &&
        renderTokenTextarea({
          value: node.text || "",
          onChange: (text) => patchNode({ text: text || undefined }),
          required: false,
        })}

      {node.type === "question" && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Save reply as</Label>
            <Input
              value={node.variable}
              onChange={(e) => patchNode({ variable: e.target.value })}
              placeholder="lead_name"
              className="h-8 w-40 font-mono md:text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Then go to</Label>
            {renderTargetSelect({
              value: node.next,
              onChange: (next) => patchNode({ next }),
            })}
          </div>
        </div>
      )}

      {node.type === "message" && (
        <div className="flex items-center gap-2">
          <Label className="text-xs">Then go to</Label>
          {renderTargetSelect({
            value: node.next,
            onChange: (next) => patchNode({ next }),
          })}
        </div>
      )}

      {node.type === "condition" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Checked top to bottom — the first match wins. Nothing is sent; this only decides where to
            go next.
          </p>
          {node.branches.map((branch, bi) => {
            const patchBranch = (patch: Partial<FlowConditionBranch>) =>
              patchNode({
                branches: node.branches.map((b, idx) => (idx === bi ? { ...b, ...patch } : b)),
              })
            return (
              <div key={bi} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">If</span>
                <Input
                  value={branch.variable}
                  onChange={(e) => patchBranch({ variable: e.target.value })}
                  placeholder="answer name"
                  className="h-8 w-36 font-mono md:text-xs"
                />
                <Select
                  value={branch.operator}
                  onValueChange={(v) => {
                    const operator = v as FlowConditionOperator
                    // The server rejects a value on is_set/is_empty and requires
                    // one everywhere else, so switching operator has to add or
                    // drop the field.
                    patchBranch({
                      operator,
                      value: operatorTakesValue(operator) ? (branch.value ?? "") : undefined,
                    })
                  }}
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPERATOR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {operatorTakesValue(branch.operator) && (
                  <Input
                    value={branch.value ?? ""}
                    onChange={(e) => patchBranch({ value: e.target.value })}
                    placeholder="value or {{token}}"
                    className="h-8 w-40 md:text-xs"
                  />
                )}
                <span className="text-xs text-muted-foreground">goes to</span>
                {renderTargetSelect({
                  value: branch.next || undefined,
                  onChange: (next) => patchBranch({ next: next || "" }),
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={node.branches.length === 1}
                  onClick={() =>
                    patchNode({ branches: node.branches.filter((_, idx) => idx !== bi) })
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
          <div className="flex flex-wrap items-center gap-3">
            {node.branches.length < MAX_BRANCHES && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  patchNode({
                    branches: [
                      ...node.branches,
                      { variable: "", operator: "equals", value: "", next: "" },
                    ],
                  })
                }
              >
                <Plus className="mr-1 h-3 w-3" /> Add branch
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Label className="text-xs">Anything else goes to</Label>
              {renderTargetSelect({
                value: node.defaultNext,
                onChange: (defaultNext) => patchNode({ defaultNext }),
              })}
            </div>
          </div>
        </div>
      )}

      {node.type === "delay" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Wait</Label>
              <Input
                type="number"
                min={1}
                max={MAX_DELAY_MINUTES}
                value={node.minutes}
                onChange={(e) => patchNode({ minutes: Math.trunc(Number(e.target.value)) })}
                className="h-8 w-24"
              />
              <span className="text-xs text-muted-foreground">
                minutes ({formatDelayMinutes(node.minutes)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Then go to</Label>
              {renderTargetSelect({
                value: node.next || undefined,
                onChange: (next) => patchNode({ next: next || "" }),
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Capped at 24 hours: flow messages are free-form text, which WhatsApp only accepts inside
            the 24-hour window after the contact&apos;s last message. The window runs from{" "}
            <em>their</em> last message, so even a shorter wait can land outside it after a long
            exchange — for a follow-up days later, use a drip sequence.
          </p>
        </div>
      )}

      {node.type === "buttons" && (
        <div className="space-y-2">
          {node.buttons.map((button, bi) => (
            <div key={bi} className="flex flex-wrap items-center gap-2">
              <Input
                value={button.title}
                onChange={(e) =>
                  patchNode({
                    buttons: node.buttons.map((b, idx) =>
                      idx === bi ? { ...b, title: e.target.value } : b
                    ),
                  })
                }
                placeholder={`Button ${bi + 1}`}
                className="h-8 w-40"
              />
              <span
                className={`text-xs ${button.title.length > 20 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {button.title.length}/20
              </span>
              <span className="text-xs text-muted-foreground">goes to</span>
              {renderTargetSelect({
                value: button.next,
                onChange: (next) =>
                  patchNode({
                    buttons: node.buttons.map((b, idx) => (idx === bi ? { ...b, next } : b)),
                  }),
              })}
              <Button
                variant="ghost"
                size="sm"
                disabled={node.buttons.length === 1}
                onClick={() => patchNode({ buttons: node.buttons.filter((_, idx) => idx !== bi) })}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            {node.buttons.length < MAX_BUTTONS && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onPatch(node.id, appendButton(node))}
              >
                <Plus className="mr-1 h-3 w-3" /> Add button
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Label className="text-xs">Non-button reply goes to</Label>
              {renderTargetSelect({
                value: node.fallbackNext,
                onChange: (fallbackNext) => patchNode({ fallbackNext }),
              })}
            </div>
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <ul className="space-y-0.5">
          {issues.map((e, i) => (
            <li key={i} className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" /> {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
