import type { FlowDefinition } from "@/services/api"
import { nodeTargets } from "@/lib/flow-validation"

export interface NodePosition {
  x: number
  y: number
}

export type FlowLayout = Record<string, NodePosition>

/**
 * Canvas geometry. Nodes are fixed-width cards; the row pitch leaves room for
 * the tallest node body (a buttons node with three targets) without overlap.
 */
export const NODE_WIDTH = 260
const COLUMN_GAP = 340
const ROW_GAP = 190
const ORIGIN_X = 40
const ORIGIN_Y = 40

/**
 * Positions every node by walking the graph breadth-first from the entry node:
 * column = distance from the entry, row = order of discovery within that
 * column. Nodes the entry can't reach are laid out in columns of their own to
 * the right, so an orphan is visible as a detached island rather than being
 * dropped from the canvas.
 *
 * Deterministic on purpose: it is what a flow shows when nobody has arranged it
 * — a starter bot, a flow saved before `definition.layout` existed, or a node
 * added since the last save. Hand-placed positions override it and are saved
 * with the definition.
 */
export function autoLayout(definition: FlowDefinition): FlowLayout {
  const byId = new Map(definition.nodes.map((n) => [n.id, n]))
  const depth = new Map<string, number>()
  const order: string[] = []

  const walk = (startId: string, startDepth: number) => {
    const queue: [string, number][] = [[startId, startDepth]]
    while (queue.length) {
      const [id, d] = queue.shift()!
      const node = byId.get(id)
      if (!node) continue
      // A node reached by two paths sits in the deeper column, so an edge
      // always points forward and the graph reads left to right.
      if (depth.has(id) && depth.get(id)! >= d) continue
      if (!depth.has(id)) order.push(id)
      depth.set(id, d)
      for (const target of nodeTargets(node)) queue.push([target, d + 1])
    }
  }

  if (definition.entryNodeId && byId.has(definition.entryNodeId)) {
    walk(definition.entryNodeId, 0)
  }

  // Unreachable nodes: each undiscovered root starts a fresh island one column
  // past everything placed so far.
  for (const node of definition.nodes) {
    if (depth.has(node.id)) continue
    const maxDepth = depth.size ? Math.max(...depth.values()) : -1
    walk(node.id, maxDepth + 2)
  }

  const rows = new Map<number, number>()
  const layout: FlowLayout = {}
  for (const id of order) {
    const d = depth.get(id) ?? 0
    const row = rows.get(d) ?? 0
    rows.set(d, row + 1)
    layout[id] = { x: ORIGIN_X + d * COLUMN_GAP, y: ORIGIN_Y + row * ROW_GAP }
  }
  return layout
}

function storageKey(flowId: string): string {
  return `flow-canvas-layout:${flowId}`
}

/**
 * Hand-placed node positions, per flow, from `localStorage`.
 *
 * The saved flow carries the real layout (`definition.layout`). This copy holds
 * a drag made on a flow that has not been saved yet — including a brand-new one
 * that has no id — so closing the tab mid-build doesn't throw the arrangement
 * away. It loses to a saved layout on load, because that one is shared and this
 * one is only this browser's.
 */
export function loadFlowLayout(flowId: string): FlowLayout {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(storageKey(flowId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    const out: FlowLayout = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const pos = value as Partial<NodePosition> | null
      if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
        out[id] = { x: pos.x, y: pos.y }
      }
    }
    return out
  } catch {
    // A corrupt or unreadable entry (private mode, quota, hand-edited JSON)
    // falls back to the auto-layout rather than breaking the builder.
    return {}
  }
}

export function saveFlowLayout(flowId: string, layout: FlowLayout): void {
  if (typeof window === "undefined") return
  try {
    if (Object.keys(layout).length === 0) {
      window.localStorage.removeItem(storageKey(flowId))
      return
    }
    window.localStorage.setItem(storageKey(flowId), JSON.stringify(layout))
  } catch {
    // Nothing to do — positions are a convenience, never a correctness concern.
  }
}
