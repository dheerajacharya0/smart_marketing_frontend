"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { AlertCircle, LayoutGrid, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { FlowDefinition, FlowNode } from "@/services/api"
import { portsForNode, type FlowPort } from "@/lib/flow-graph"
import { NODE_WIDTH, type FlowLayout, type NodePosition } from "@/lib/flow-layout"
import { NODE_TYPE_META, NODE_TYPES } from "./flow-node-meta"

const DRAG_MIME = "application/x-flow-node-type"

type FlowCardData = {
  node: FlowNode
  isEntry: boolean
  issueCount: number
  ports: FlowPort[]
  onSetEntry: (id: string) => void
} & Record<string, unknown>

type FlowCardNode = Node<FlowCardData, "flowCard">

function summarise(node: FlowNode): string {
  switch (node.type) {
    case "message":
    case "buttons":
    case "question":
      return node.text || "No text yet"
    case "condition":
      return `${node.branches.length} branch${node.branches.length === 1 ? "" : "es"}`
    case "delay":
      return `Waits ${node.minutes} min`
    case "handoff":
      return node.text || "Hands over to an agent"
    case "end":
      return node.text || "Ends the conversation"
  }
}

/**
 * One node as a card on the canvas.
 *
 * Each outgoing port gets its own row with its own source handle, so dragging
 * from "Button 2" writes that button's target and nothing else — the alternative
 * (one handle per node) can't express which of three buttons an edge belongs to.
 */
function FlowCard({ data, selected }: NodeProps<FlowCardNode>) {
  const { node, isEntry, issueCount, ports, onSetEntry } = data
  const meta = NODE_TYPE_META[node.type]
  return (
    <div
      className={`relative rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow ${
        selected ? "ring-2 ring-primary" : ""
      } ${issueCount > 0 ? "border-destructive/60" : ""}`}
      style={{ width: NODE_WIDTH }}
    >
      <div className={`absolute left-0 top-0 h-full w-1 rounded-l-lg ${meta.accentClass}`} />
      {/* Anything can point at this node, so the target handle is unnamed. */}
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !bg-background" />

      <div className="space-y-1.5 p-3 pl-4">
        <div className="flex items-center gap-1.5">
          <Badge className={`${meta.badgeClass} hover:${meta.badgeClass} text-[10px]`}>{meta.label}</Badge>
          {isEntry ? (
            <Badge variant="outline" className="border-primary text-primary text-[10px]">
              <Play className="mr-1 h-2.5 w-2.5" /> Entry
            </Badge>
          ) : (
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onSetEntry(node.id)
              }}
            >
              set entry
            </button>
          )}
          {issueCount > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-destructive">
              <AlertCircle className="h-3 w-3" /> {issueCount}
            </span>
          )}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">{node.id}</p>
        <p className="line-clamp-2 text-xs">{summarise(node)}</p>
      </div>

      {ports.length > 0 && (
        <div className="border-t">
          {ports.map((port) => (
            <div
              key={port.id}
              className="relative flex items-center justify-end gap-1 px-3 py-1 pr-4 text-[10px]"
            >
              <span
                className={`truncate ${
                  !port.target && port.required ? "text-destructive" : "text-muted-foreground"
                }`}
                title={port.label}
              >
                {port.label}
                {!port.target && (port.required ? " — needs a target" : " — ends flow")}
              </span>
              <Handle
                type="source"
                id={port.id}
                position={Position.Right}
                className="!h-2.5 !w-2.5 !border-2 !bg-background"
                style={{ right: -5, top: "50%" }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Module-level so the map identity is stable — React Flow warns and re-mounts
// every node when `nodeTypes` changes between renders.
const nodeTypes = { flowCard: FlowCard }

export interface FlowCanvasProps {
  definition: FlowDefinition
  positions: FlowLayout
  selectedNodeId: string | null
  issueCountFor: (nodeId: string) => number
  onSelect: (nodeId: string | null) => void
  onMoveNode: (nodeId: string, position: NodePosition) => void
  /** Called once a drag settles, so a position is written to storage per drag, not per frame. */
  onCommitPositions: () => void
  onConnectPort: (sourceId: string, portId: string, targetId: string | undefined) => void
  onAddNode: (type: FlowNode["type"]) => string
  onPlaceNode: (nodeId: string, position: NodePosition) => void
  onRemoveNode: (nodeId: string) => void
  onSetEntry: (nodeId: string) => void
  onAutoArrange: () => void
}

function CanvasInner({
  definition,
  positions,
  selectedNodeId,
  issueCountFor,
  onSelect,
  onMoveNode,
  onCommitPositions,
  onConnectPort,
  onAddNode,
  onPlaceNode,
  onRemoveNode,
  onSetEntry,
  onAutoArrange,
}: FlowCanvasProps) {
  const { resolvedTheme } = useTheme()
  const { screenToFlowPosition } = useReactFlow()

  const derivedNodes = useMemo<FlowCardNode[]>(
    () =>
      definition.nodes.map((node) => ({
        id: node.id,
        type: "flowCard" as const,
        position: positions[node.id] ?? { x: 40, y: 40 },
        selected: node.id === selectedNodeId,
        data: {
          node,
          isEntry: definition.entryNodeId === node.id,
          issueCount: issueCountFor(node.id),
          ports: portsForNode(node),
          onSetEntry,
        },
      })),
    [definition, positions, selectedNodeId, issueCountFor, onSetEntry]
  )

  // React Flow reads each node's measured size off the node object it is given.
  // Handing it a freshly built array on every keystroke would drop `measured`
  // and force a re-measure — edges detach from their handles for a frame each
  // time — so the derived nodes are merged into state that keeps what React
  // Flow measured.
  const [nodes, setNodes] = useState<FlowCardNode[]>(derivedNodes)
  useEffect(() => {
    setNodes((prev) => {
      const previous = new Map(prev.map((n) => [n.id, n]))
      return derivedNodes.map((node) => {
        const existing = previous.get(node.id)
        return existing ? { ...existing, ...node, measured: existing.measured } : node
      })
    })
  }, [derivedNodes])

  const edges = useMemo<Edge[]>(() => {
    const known = new Set(definition.nodes.map((n) => n.id))
    const list: Edge[] = []
    for (const node of definition.nodes) {
      for (const port of portsForNode(node)) {
        // A target that no longer exists is left undrawn rather than drawn to
        // nowhere; validation is what tells the user about it.
        if (!port.target || !known.has(port.target)) continue
        list.push({
          id: `${node.id}::${port.id}`,
          source: node.id,
          sourceHandle: port.id,
          target: port.target,
          label: node.type === "message" || node.type === "question" || node.type === "delay" ? undefined : port.label,
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        })
      }
    }
    return list
  }, [definition])

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowCardNode>[]) => {
      // Dimension and drag-state changes are React Flow's own bookkeeping and
      // have to be applied for handles to stay measured.
      setNodes((prev) => applyNodeChanges(changes, prev))
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          onMoveNode(change.id, change.position)
          if (change.dragging === false) onCommitPositions()
        }
        if (change.type === "remove") onRemoveNode(change.id)
      }
    },
    [onMoveNode, onCommitPositions, onRemoveNode]
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !connection.sourceHandle) return
      onConnectPort(connection.source, connection.sourceHandle, connection.target)
    },
    [onConnectPort]
  )

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) {
        if (edge.sourceHandle) onConnectPort(edge.source, edge.sourceHandle, undefined)
      }
    },
    [onConnectPort]
  )

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData(DRAG_MIME) as FlowNode["type"]
      if (!NODE_TYPES.includes(type)) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const id = onAddNode(type)
      // Centre the card on the cursor rather than hanging it off the pointer.
      onPlaceNode(id, { x: position.x - NODE_WIDTH / 2, y: position.y - 24 })
      onCommitPositions()
      onSelect(id)
    },
    [screenToFlowPosition, onAddNode, onPlaceNode, onCommitPositions, onSelect]
  )

  return (
    <div
      className="h-[600px] w-full rounded-lg border"
      onDrop={handleDrop}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DRAG_MIME)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        onNodesChange={handleNodesChange}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        // Backspace is left out on purpose: it is the key people reach for while
        // editing a node's text, and the inspector sits next to the canvas.
        deleteKeyCode={["Delete"]}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!hidden md:!block" />
        <Panel position="top-left" className="max-w-[calc(100%-1rem)]">
          <div className="rounded-md border bg-background/95 p-2 shadow-sm backdrop-blur">
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Drag onto the canvas
            </p>
            <div className="flex flex-wrap gap-1">
              {NODE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_MIME, type)
                    event.dataTransfer.effectAllowed = "copy"
                  }}
                  onClick={() => onSelect(onAddNode(type))}
                  title={NODE_TYPE_META[type].hint}
                  className={`cursor-grab rounded border px-2 py-1 text-[11px] active:cursor-grabbing ${NODE_TYPE_META[type].badgeClass}`}
                >
                  {NODE_TYPE_META[type].label}
                </button>
              ))}
            </div>
          </div>
        </Panel>
        <Panel position="top-right">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAutoArrange}>
            <LayoutGrid className="mr-1 h-3 w-3" /> Auto arrange
          </Button>
        </Panel>
      </ReactFlow>
    </div>
  )
}

/**
 * Visual builder for a flow's graph: nodes as cards, targets as edges.
 *
 * The provider wrapper is required for `screenToFlowPosition` (used by the
 * palette's drop handler) to see the canvas it belongs to.
 */
export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
