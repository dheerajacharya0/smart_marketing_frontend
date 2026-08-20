"use client"

import { useCallback, useMemo, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, MousePointerClick } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  type FlowIssue,
} from "@/lib/flow-validation"
import { removeNodeFromDefinition, setPortTarget } from "@/lib/flow-graph"
import type { FlowStarter } from "@/lib/flow-starters"
import { FlowSimulator } from "./flow-simulator"
import { FlowCanvas } from "./flow-canvas"
import { FlowNodeEditor } from "./flow-node-editor"
import { useFlowLayout } from "./use-flow-layout"

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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // Canvas coordinates are saved with the flow (`definition.layout`). The
  // `localStorage` copy under this key is what carries a drag on a flow that
  // hasn't been saved yet — a new flow shares one key until it has an id.
  const layout = useFlowLayout(flow?.id ?? "new", definition)

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

  const addNode = useCallback((type: FlowNode["type"]): string => {
    const id = generateNodeId(type, new Set(definition.nodes.map((n) => n.id)))
    setServerError(null)
    setDefinition((prev) => ({
      entryNodeId: prev.entryNodeId || id,
      nodes: [...prev.nodes, emptyNode(type, id)],
    }))
    return id
  }, [definition.nodes])

  const removeNode = useCallback(
    (id: string) => {
      setServerError(null)
      setDefinition((prev) => removeNodeFromDefinition(prev, id))
      layout.forgetNode(id)
      setSelectedNodeId((current) => (current === id ? null : current))
    },
    [layout]
  )

  const handleRename = (oldId: string, newId: string) => {
    const trimmed = newId.trim()
    if (!trimmed || trimmed === oldId) return
    setServerError(null)
    setDefinition((prev) => renameNode(prev, oldId, trimmed))
    layout.renameNodeKey(oldId, trimmed)
    setSelectedNodeId((current) => (current === oldId ? trimmed : current))
  }

  const setEntry = useCallback((id: string) => {
    setServerError(null)
    setDefinition((prev) => ({ ...prev, entryNodeId: id }))
  }, [])

  /** Drag-connect and edge-delete both land here: one port, one target. */
  const connectPort = useCallback((sourceId: string, portId: string, targetId: string | undefined) => {
    setServerError(null)
    setDefinition((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === sourceId ? setPortTarget(n, portId, targetId) : n)),
    }))
  }, [])

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
        // The canvas arrangement travels with the definition. Rebuilt from the
        // live positions rather than reusing whatever `layout` was loaded with,
        // so a node deleted this session doesn't keep its coordinates.
        definition: { ...definition, layout: layout.layoutForSave() },
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
      if (nodeId) setSelectedNodeId(nodeId)
      else toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const nodeIssues = useCallback(
    (id: string) => {
      const list = issues.filter((i) => i.nodeId === id).map((i) => i.message)
      if (serverError?.nodeId === id) list.push(serverError.message)
      return list
    },
    [issues, serverError]
  )
  const issueCountFor = useCallback((id: string) => nodeIssues(id).length, [nodeIssues])
  const selectedNode = definition.nodes.find((n) => n.id === selectedNodeId) || null

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Canvas</h3>
            <p className="text-xs text-muted-foreground">
              Drag a node type in, drag a handle to a node to connect it, and click a card to edit it.
              Select an edge and press Delete to unlink.
            </p>
          </div>

          {definition.nodes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Drag a node type from the palette onto the canvas to start — the flow runs from the
                entry node and follows the arrows.
              </CardContent>
            </Card>
          ) : null}

          <FlowCanvas
            definition={definition}
            positions={layout.positions}
            selectedNodeId={selectedNodeId}
            issueCountFor={issueCountFor}
            onSelect={setSelectedNodeId}
            onMoveNode={layout.moveNode}
            onCommitPositions={layout.commitPositions}
            onConnectPort={connectPort}
            onAddNode={addNode}
            onPlaceNode={layout.placeNode}
            onRemoveNode={removeNode}
            onSetEntry={setEntry}
            onAutoArrange={layout.resetLayout}
          />
        </div>

        <div className="space-y-6 lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {selectedNode ? "Selected node" : "No node selected"}
              </CardTitle>
              {!selectedNode && (
                <CardDescription>Click a card on the canvas to edit its text and targets.</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {selectedNode ? (
                <FlowNodeEditor
                  node={selectedNode}
                  definition={definition}
                  isEntry={definition.entryNodeId === selectedNode.id}
                  issues={nodeIssues(selectedNode.id)}
                  tokens={tokens}
                  onPatch={patchNode}
                  onRename={handleRename}
                  onRemove={removeNode}
                  onSetEntry={setEntry}
                  onAddNode={addNode}
                />
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MousePointerClick className="h-4 w-4 shrink-0" /> Nothing selected.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Validation</CardTitle>
            </CardHeader>
            <CardContent>
              {issues.length === 0 ? (
                <p className="text-sm text-success flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Flow is valid and ready to save.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {issues.map((issue, i) => (
                    <li key={i} className="text-sm text-destructive flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      {issue.nodeId ? (
                        // Clicking an issue selects the node it belongs to —
                        // on a canvas the offending card can be off-screen.
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => setSelectedNodeId(issue.nodeId)}
                        >
                          <span className="font-mono text-xs">[{issue.nodeId}]</span> {issue.message}
                        </button>
                      ) : (
                        <span>{issue.message}</span>
                      )}
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
