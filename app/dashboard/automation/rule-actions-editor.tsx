"use client"

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConversationChargeNote } from "@/components/cost-estimate"
import { NoApprovedTemplates } from "@/components/no-approved-templates"
import type { AutomationAction, Flow, WhatsappTemplate } from "@/services/api"
import type { TeamAssignee } from "@/hooks/use-team-members"
import {
  ACTIONS_MAX,
  ACTION_LABELS,
  ACTION_TYPES,
  SEND_TEXT_MAX,
  TAG_MAX,
  defaultAction,
  type AutomationActionType,
  type RuleIssue,
} from "@/lib/automation-rules"

/**
 * "Then do this" — an ordered list, run top to bottom.
 *
 * Order is meaningful and each action is independently fallible server-side: one
 * failing action doesn't abort the rest, so "tag then reply" still tags when the
 * reply fails. That's why the rows move rather than sort themselves.
 *
 * The `automation-known-tags` / `automation-attribute-keys` datalists the inputs
 * suggest from are rendered once by the page — an id has to be unique in the
 * document, and the conditions editor suggests from the same two lists.
 */
export function RuleActionsEditor({
  actions,
  onChange,
  issues,
  templates,
  allTemplates,
  flows,
  agents,
}: {
  actions: AutomationAction[]
  onChange: (actions: AutomationAction[]) => void
  issues: RuleIssue[]
  templates: WhatsappTemplate[]
  /** Every status, for the empty state's review/rejected counts; null while loading. */
  allTemplates?: WhatsappTemplate[] | null
  flows: Flow[]
  agents: TeamAssignee[]
}) {
  const listIssues = issues.filter((i) => i.index === undefined).map((i) => i.message)
  const rowIssue = (index: number) => issues.find((i) => i.index === index)?.message

  const update = (index: number, action: AutomationAction) => {
    const next = [...actions]
    next[index] = action
    onChange(next)
  }

  const remove = (index: number) => onChange(actions.filter((_, i) => i !== index))

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= actions.length) return
    const next = [...actions]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    onChange(next)
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label>Then do this</Label>
        <span className="text-xs text-muted-foreground">
          {actions.length}/{ACTIONS_MAX} · runs in order
        </span>
      </div>

      {actions.map((action, index) => (
        <div key={index} className="space-y-2 rounded-md bg-muted/40 p-2">
          <div className="flex items-center gap-2">
            <span className="w-5 text-center text-xs text-muted-foreground">{index + 1}</span>
            <Select
              value={action.type}
              onValueChange={(v) => update(index, defaultAction(v as AutomationActionType))}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ACTION_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={index === actions.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {action.type === "send_text" && (
            <>
              <Textarea
                value={action.text}
                maxLength={SEND_TEXT_MAX}
                onChange={(e) => update(index, { ...action, text: e.target.value })}
                placeholder="Thanks for reaching out! We're open 9am–8pm, Mon–Sat."
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{name}}"}, {"{{waId}}"} or {"{{attributes.city}}"} to personalise. Only works
                inside the 24-hour window — outside it, send a template instead.
              </p>
            </>
          )}

          {action.type === "send_template" && allTemplates && templates.length === 0 && (
            <NoApprovedTemplates templates={allTemplates} returnTo="/dashboard/automation" />
          )}

          {action.type === "send_template" && !(allTemplates && templates.length === 0) && (
            <>
              <Select
                value={action.templateName}
                onValueChange={(name) => {
                  const template = templates.find((t) => t.name === name)
                  update(index, {
                    ...action,
                    templateName: name,
                    templateLanguage: template?.language ?? "",
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={allTemplates ? "Pick a template" : "Loading templates…"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={`${t.name}:${t.language}`} value={t.name}>
                      {t.name} ({t.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Approved templates only — they&apos;re the only thing that can be sent outside the
                24-hour window.
              </p>
              {/* Whether this costs anything depends on the trigger, not the
                  rule: a reply to an incoming message lands inside an open
                  window, while a tag change or a no-reply timer does not. */}
              {action.templateName && (
                <ConversationChargeNote
                  category={templates.find((t) => t.name === action.templateName)?.category}
                />
              )}
            </>
          )}

          {(action.type === "add_tag" || action.type === "remove_tag") && (
            <Input
              list="automation-known-tags"
              value={action.tag}
              maxLength={TAG_MAX}
              onChange={(e) => update(index, { ...action, tag: e.target.value })}
              placeholder="vip"
            />
          )}

          {action.type === "set_attribute" && (
            <div className="flex gap-2">
              <Input
                className="w-40"
                list="automation-attribute-keys"
                value={action.key}
                onChange={(e) => update(index, { ...action, key: e.target.value })}
                placeholder="stage"
              />
              <Input
                className="flex-1"
                value={action.value}
                onChange={(e) => update(index, { ...action, value: e.target.value })}
                placeholder="lead"
              />
            </div>
          )}

          {action.type === "assign_agent" && (
            <Select
              value={action.agentUserId}
              onValueChange={(userId) => {
                const agent = agents.find((a) => a.userId === userId)
                update(index, { ...action, agentUserId: userId, agentName: agent?.name })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={agents.length ? "Pick a teammate" : "No teammates yet"} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.userId} value={a.userId}>
                    {a.name} ({a.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {action.type === "start_flow" && (
            <>
              <Select
                value={action.flowId}
                onValueChange={(flowId) => update(index, { ...action, flowId })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={flows.length ? "Pick a flow" : "No flows built yet"} />
                </SelectTrigger>
                <SelectContent>
                  {flows.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Use this when the rule needs to ask a question and branch on the answer — that lives
                in the flow builder, not here.
              </p>
            </>
          )}

          {action.type === "call_webhook" && (
            <>
              <Input
                value={action.url}
                onChange={(e) => update(index, { ...action, url: e.target.value })}
                placeholder="https://example.com/hooks/whatsapp"
              />
              <div className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm">Include the contact&apos;s details</span>
                <Switch
                  checked={action.includeContact !== false}
                  onCheckedChange={(v) => update(index, { ...action, includeContact: v })}
                />
              </div>
            </>
          )}

          {rowIssue(index) && <p className="text-xs text-destructive">{rowIssue(index)}</p>}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={actions.length >= ACTIONS_MAX}
        onClick={() => onChange([...actions, defaultAction("send_text")])}
      >
        <Plus className="mr-2 h-3.5 w-3.5" /> Add action
      </Button>

      {listIssues.map((message) => (
        <p key={message} className="text-xs text-destructive">
          {message}
        </p>
      ))}
    </div>
  )
}
