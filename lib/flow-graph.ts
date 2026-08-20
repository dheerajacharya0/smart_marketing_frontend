import type { FlowDefinition, FlowNode } from "@/services/api"
import { operatorTakesValue, CONDITION_OPERATOR_OPTIONS } from "@/lib/flow-validation"

/**
 * One outgoing connection point on a node.
 *
 * Every node type answers "where can an edge leave from" through this shape, so
 * the canvas can draw handles and the connect/disconnect handlers can write the
 * definition back without a switch per node type at every call site. `id` is
 * what React Flow carries as `sourceHandle`, so it has to survive a round trip
 * through the DOM — keep it string-safe and stable for a given node shape.
 */
export interface FlowPort {
  id: string
  /** Short label drawn next to the handle and on the edge. */
  label: string
  target?: string
  /** True when leaving this port unset is a validation error, not a choice. */
  required: boolean
}

export const BUTTON_PORT = "btn"
export const BRANCH_PORT = "branch"
export const FALLBACK_PORT = "fallback"
export const DEFAULT_PORT = "default"
export const NEXT_PORT = "next"

function branchLabel(branch: { variable: string; operator: string; value?: string }): string {
  const operator =
    CONDITION_OPERATOR_OPTIONS.find((o) => o.value === branch.operator)?.label || branch.operator
  const variable = branch.variable || "?"
  if (!operatorTakesValue(branch.operator as never)) return `${variable} ${operator}`
  return `${variable} ${operator} ${branch.value || "?"}`
}

export function portsForNode(node: FlowNode): FlowPort[] {
  switch (node.type) {
    case "message":
    case "question":
      return [{ id: NEXT_PORT, label: "then", target: node.next, required: false }]
    case "delay":
      // A delay with nowhere to go holds a session open for nothing, so the
      // backend requires the target — surfaced here as a required port.
      return [{ id: NEXT_PORT, label: "then", target: node.next || undefined, required: true }]
    case "buttons":
      return [
        ...node.buttons.map((b, i) => ({
          id: `${BUTTON_PORT}:${i}`,
          label: b.title || `Button ${i + 1}`,
          target: b.next,
          required: true,
        })),
        { id: FALLBACK_PORT, label: "other reply", target: node.fallbackNext, required: false },
      ]
    case "condition":
      return [
        ...node.branches.map((b, i) => ({
          id: `${BRANCH_PORT}:${i}`,
          label: branchLabel(b),
          target: b.next || undefined,
          required: true,
        })),
        { id: DEFAULT_PORT, label: "anything else", target: node.defaultNext, required: false },
      ]
    default:
      // handoff and end are terminal — nothing leaves them.
      return []
  }
}

/**
 * Points one port at a node (or clears it with `undefined`).
 *
 * Required ports store `""` rather than dropping the key when cleared: the
 * backend's schema declares them as present-and-non-empty, and an empty string
 * is what the existing editors already round-trip, so validation reports "needs
 * a target" instead of a shape error.
 */
export function setPortTarget(node: FlowNode, portId: string, target: string | undefined): FlowNode {
  const [kind, indexText] = portId.split(":")
  const index = Number(indexText)

  switch (node.type) {
    case "message":
    case "question":
      return kind === NEXT_PORT ? { ...node, next: target } : node
    case "delay":
      return kind === NEXT_PORT ? { ...node, next: target ?? "" } : node
    case "buttons":
      if (kind === FALLBACK_PORT) return { ...node, fallbackNext: target }
      if (kind !== BUTTON_PORT || Number.isNaN(index)) return node
      return {
        ...node,
        buttons: node.buttons.map((b, i) => (i === index ? { ...b, next: target } : b)),
      }
    case "condition":
      if (kind === DEFAULT_PORT) return { ...node, defaultNext: target }
      if (kind !== BRANCH_PORT || Number.isNaN(index)) return node
      return {
        ...node,
        branches: node.branches.map((b, i) => (i === index ? { ...b, next: target ?? "" } : b)),
      }
    default:
      return node
  }
}

/**
 * Adds an empty button to a buttons node, giving every button an explicit
 * reply id.
 *
 * The server fills a missing id with `<nodeId>-<index>` and rejects duplicates
 * within a node, which is a trap for the delete-then-add sequence: deleting the
 * first of `menu-0, menu-1` and appending a fresh button would have the new one
 * derived as `menu-1` — the id the surviving button already carries. Assigning
 * ids here, avoiding both the ids in use and the ones the server would derive,
 * keeps that save from 400ing. Ids already present are never rewritten: they are
 * what an in-flight tap is matched on.
 */
export function appendButton(node: Extract<FlowNode, { type: "buttons" }>): FlowNode {
  const buttons = node.buttons.map((b, i) => ({ ...b, id: b.id ?? `${node.id}-${i}` }))
  const used = new Set(buttons.map((b) => b.id))
  let index = buttons.length
  while (used.has(`${node.id}-${index}`)) index += 1
  return { ...node, buttons: [...buttons, { id: `${node.id}-${index}`, title: "" }] }
}

/**
 * Drops a node and clears every reference to it, across all node types.
 *
 * The clearing half matters more than the removal: a target left pointing at a
 * deleted node is rejected by the backend with `points to unknown node`, and
 * the person who deleted it has no way to see which node still holds the
 * reference.
 */
export function removeNodeFromDefinition(definition: FlowDefinition, id: string): FlowDefinition {
  return {
    entryNodeId: definition.entryNodeId === id ? "" : definition.entryNodeId,
    nodes: definition.nodes
      .filter((n) => n.id !== id)
      .map((node) =>
        portsForNode(node).reduce(
          (acc, port) => (port.target === id ? setPortTarget(acc, port.id, undefined) : acc),
          node
        )
      ),
  }
}
