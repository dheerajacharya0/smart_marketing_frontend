"use client"

import { useMemo, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
import { toast } from "react-hot-toast"
import {
  createFlow,
  updateFlow,
  type Flow,
  type FlowDefinition,
  type FlowNode,
  type WhatsappContext,
} from "@/services/api"
import {
  validateFlow,
  renameNode,
  parseFlowErrorNodeId,
  availableTokens,
  generateNodeId,
  emptyNode,
  MAX_BUTTONS,
  type FlowIssue,
} from "@/lib/flow-validation"
import type { FlowStarter } from "@/lib/flow-starters"
import { FlowSimulator } from "./flow-simulator"

const END_SENTINEL = "__end__"
const NEW_SENTINEL = "__new__"

const NODE_TYPE_META: Record<FlowNode["type"], { label: string; badgeClass: string }> = {
  message: { label: "Message", badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400" },
  buttons: { label: "Buttons", badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-400" },
  question: { label: "Question", badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400" },
  handoff: { label: "Handoff", badgeClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400" },
  end: { label: "End", badgeClass: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
}

export function FlowBuilder({
  context,
  flow,
  starter,
}: {
  context: WhatsappContext
  flow?: Flow | null
  /**
   * Pre-fills a new flow from `lib/flow-starters.ts`. Kept separate from `flow`
   * so `isEdit` stays false — a synthetic flow would make the builder PATCH an
   * id that doesn't exist. Ignored when editing.
   */
  starter?: FlowStarter | null
}) {
  const router = useRouter()
  const isEdit = !!flow
  const seed = isEdit ? null : starter

  const [name, setName] = useState(flow?.name || seed?.name || "")
  const [description, setDescription] = useState(flow?.description || seed?.description || "")
  const [triggerMatchType, setTriggerMatchType] = useState<"exact" | "contains" | "any">(
    flow?.triggerMatchType || seed?.triggerMatchType || "contains"
  )
  const [keywordsText, setKeywordsText] = useState(
    (flow?.triggerKeywords || seed?.triggerKeywords || []).join(", ")
  )
  const [priority, setPriority] = useState(String(flow?.priority ?? 0))
  const [isActive, setIsActive] = useState(flow?.isActive ?? true)
  const [definition, setDefinition] = useState<FlowDefinition>(() => {
    if (flow?.definition) return flow.definition
    // Deep-copied: the builder mutates nodes in place as you edit, and the
    // starter module is a shared singleton — editing one flow must not change
    // what the next person cloning that starter gets.
    if (seed) return structuredClone(seed.definition)
    return { entryNodeId: "", nodes: [] }
  })
  const [isSaving, setIsSaving] = useState(false)
  const [serverError, setServerError] = useState<{ nodeId: string | null; message: string } | null>(null)

  const issues = useMemo(() => {
    const list: FlowIssue[] = [...validateFlow(definition)]
    if (!name.trim()) list.unshift({ nodeId: null, message: "Flow name is required" })
    if (triggerMatchType !== "any" && !keywordsText.trim())
      list.unshift({ nodeId: null, message: "Trigger keywords are required unless match type is Any" })
    return list
  }, [definition, name, triggerMatchType, keywordsText])

  const tokens = availableTokens(definition.nodes)
  const canSave = issues.length === 0

  const updateNodes = (mutate: (nodes: FlowNode[]) => FlowNode[]) => {
    setServerError(null)
    setDefinition((prev) => ({ ...prev, nodes: mutate(prev.nodes) }))
  }

  const patchNode = (id: string, patch: Partial<FlowNode>) => {
    updateNodes((nodes) => nodes.map((n) => (n.id === id ? ({ ...n, ...patch } as FlowNode) : n)))
  }

  const addNode = (type: FlowNode["type"]): string => {
    const id = generateNodeId(type, new Set(definition.nodes.map((n) => n.id)))
    setServerError(null)
    setDefinition((prev) => ({
      entryNodeId: prev.entryNodeId || id,
      nodes: [...prev.nodes, emptyNode(type, id)],
    }))
    return id
  }

  const removeNode = (id: string) => {
    setServerError(null)
    setDefinition((prev) => ({
      entryNodeId: prev.entryNodeId === id ? "" : prev.entryNodeId,
      // Clear every reference to the removed node so no target dangles
      nodes: prev.nodes
        .filter((n) => n.id !== id)
        .map((n) => {
          const copy = { ...n } as FlowNode
          if ((copy.type === "message" || copy.type === "question") && copy.next === id) copy.next = undefined
          if (copy.type === "buttons") {
            copy.buttons = copy.buttons.map((b) => (b.next === id ? { ...b, next: undefined } : b))
            if (copy.fallbackNext === id) copy.fallbackNext = undefined
          }
          return copy
        }),
    }))
  }

  const handleRename = (oldId: string, newId: string) => {
    if (!newId.trim() || newId === oldId) return
    setServerError(null)
    setDefinition((prev) => renameNode(prev, oldId, newId.trim()))
  }

  // Render helpers (plain functions, not nested components — a nested
  // component's identity changes every render, remounting inputs and
  // dropping focus mid-keystroke).
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
          onChange(addNode("message"))
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
    nodeId,
    value,
    onChange,
    required,
  }: {
    nodeId: string
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
                    <DropdownMenuItem key={`${nodeId}-${t}`} onClick={() => onChange(value + `{{${t}}}`)}>
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

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    setServerError(null)
    try {
      const keywords = keywordsText
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
      const payload = {
        accountId: context.accountId,
        phoneNumberId: context.phoneNumberId,
        name: name.trim(),
        description: description.trim() || undefined,
        triggerMatchType,
        ...(triggerMatchType !== "any" ? { triggerKeywords: keywords } : {}),
        isActive,
        priority: Number(priority) || 0,
        definition,
      }
      if (isEdit && flow) {
        await updateFlow(flow.id, payload)
        toast.success("Flow updated")
      } else {
        await createFlow(payload)
        toast.success("Flow created")
      }
      router.push("/dashboard/flows")
    } catch (err) {
      const message = getErrorMessage(err) || "Failed to save flow"
      const nodeId = parseFlowErrorNodeId(message)
      setServerError({ nodeId, message })
      if (!nodeId) toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const nodeIssues = (id: string) => {
    const list = issues.filter((i) => i.nodeId === id).map((i) => i.message)
    if (serverError?.nodeId === id) list.push(serverError.message)
    return list
  }
  const flowIssues = issues.filter((i) => i.nodeId === null)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/flows")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to flows
        </Button>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">{isEdit ? "Edit Flow" : "New Flow"}</h2>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Save Changes" : "Create Flow"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trigger</CardTitle>
          <CardDescription>
            An inbound message starts this flow when it matches. Lower priority number runs first; flows
            take priority over automation rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="flow-name">Name</Label>
            <Input id="flow-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead qualifier" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="flow-description">Description (optional)</Label>
            <Input id="flow-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Phone number</Label>
            <Input value={context.displayPhoneNumber || context.phoneNumberId} disabled />
          </div>
          <div className="grid gap-2">
            <Label>Trigger match</Label>
            <Select value={triggerMatchType} onValueChange={(v) => setTriggerMatchType(v as typeof triggerMatchType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Exact keyword</SelectItem>
                <SelectItem value="contains">Contains keyword</SelectItem>
                <SelectItem value="any">Any message</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {triggerMatchType !== "any" && (
            <div className="grid gap-2">
              <Label htmlFor="flow-keywords">Keywords (comma separated)</Label>
              <Input
                id="flow-keywords"
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="start, menu, hi"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="flow-priority">Priority</Label>
            <Input
              id="flow-priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2 lg:col-span-1">
            <Label>Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Nodes</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add node <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(NODE_TYPE_META) as FlowNode["type"][]).map((type) => (
                  <DropdownMenuItem key={type} onClick={() => addNode(type)}>
                    {NODE_TYPE_META[type].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {definition.nodes.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Add your first node — the flow starts at the entry node and walks the graph from there.
              </CardContent>
            </Card>
          )}

          {definition.nodes.map((node) => {
            const errs = nodeIssues(node.id)
            const isEntry = definition.entryNodeId === node.id
            return (
              <Card key={node.id} className={errs.length ? "border-destructive/50" : undefined}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`${NODE_TYPE_META[node.type].badgeClass} hover:${NODE_TYPE_META[node.type].badgeClass}`}>
                      {NODE_TYPE_META[node.type].label}
                    </Badge>
                    <Input
                      defaultValue={node.id}
                      key={node.id}
                      onBlur={(e) => handleRename(node.id, e.target.value)}
                      className="h-8 w-44 font-mono text-xs"
                      title="Node id — renaming updates everything that points here"
                    />
                    {isEntry ? (
                      <Badge variant="outline" className="border-primary text-primary">
                        Entry point
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setServerError(null)
                          setDefinition((prev) => ({ ...prev, entryNodeId: node.id }))
                        }}
                      >
                        Set as entry
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-destructive hover:text-destructive"
                      onClick={() => removeNode(node.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {(node.type === "message" || node.type === "buttons" || node.type === "question") &&
                    renderTokenTextarea({
                      nodeId: node.id,
                      value: node.text,
                      onChange: (text) => patchNode(node.id, { text }),
                      required: true,
                    })}
                  {(node.type === "handoff" || node.type === "end") &&
                    renderTokenTextarea({
                      nodeId: node.id,
                      value: node.text || "",
                      onChange: (text) => patchNode(node.id, { text: text || undefined }),
                      required: false,
                    })}

                  {node.type === "question" && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Save reply as</Label>
                        <Input
                          value={node.variable}
                          onChange={(e) => patchNode(node.id, { variable: e.target.value })}
                          placeholder="lead_name"
                          className="h-8 w-40 font-mono text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Then go to</Label>
                        {renderTargetSelect({
                          value: node.next,
                          onChange: (next) => patchNode(node.id, { next }),
                        })}
                      </div>
                    </div>
                  )}

                  {node.type === "message" && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Then go to</Label>
                      {renderTargetSelect({
                        value: node.next,
                        onChange: (next) => patchNode(node.id, { next }),
                      })}
                    </div>
                  )}

                  {node.type === "buttons" && (
                    <div className="space-y-2">
                      {node.buttons.map((button, bi) => (
                        <div key={bi} className="flex flex-wrap items-center gap-2">
                          <Input
                            value={button.title}
                            onChange={(e) =>
                              patchNode(node.id, {
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
                          <span className="text-xs text-muted-foreground">→</span>
                          {renderTargetSelect({
                            value: button.next,
                            onChange: (next) =>
                              patchNode(node.id, {
                                buttons: node.buttons.map((b, idx) => (idx === bi ? { ...b, next } : b)),
                              }),
                          })}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={node.buttons.length === 1}
                            onClick={() =>
                              patchNode(node.id, { buttons: node.buttons.filter((_, idx) => idx !== bi) })
                            }
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
                            onClick={() =>
                              patchNode(node.id, { buttons: [...node.buttons, { title: "" }] })
                            }
                          >
                            <Plus className="mr-1 h-3 w-3" /> Add button
                          </Button>
                        )}
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Non-button reply goes to</Label>
                          {renderTargetSelect({
                            value: node.fallbackNext,
                            onChange: (fallbackNext) => patchNode(node.id, { fallbackNext }),
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {errs.length > 0 && (
                    <ul className="space-y-0.5">
                      {errs.map((e, i) => (
                        <li key={i} className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {e}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="space-y-6 lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle>Validation</CardTitle>
            </CardHeader>
            <CardContent>
              {issues.length === 0 ? (
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Flow is valid and ready to save.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {issues.map((issue, i) => (
                    <li key={i} className="text-sm text-destructive flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        {issue.nodeId && <span className="font-mono text-xs">[{issue.nodeId}]</span>}{" "}
                        {issue.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {serverError && !serverError.nodeId && (
                <p className="text-sm text-destructive mt-2">{serverError.message}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Chat</CardTitle>
              <CardDescription>Simulates the flow locally.</CardDescription>
            </CardHeader>
            <CardContent>
              <FlowSimulator definition={definition} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
