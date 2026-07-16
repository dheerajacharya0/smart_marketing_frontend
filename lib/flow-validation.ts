import type { FlowDefinition, FlowNode } from "@/services/api"

// Mirrors the backend's flow constraints so authors get friendly inline
// errors instead of 400s. Backend remains the source of truth.

export interface FlowIssue {
  nodeId: string | null // null = flow-level issue (e.g. missing entry)
  message: string
}

export const NODE_ID_MAX = 64
export const TEXT_MAX = 1024
export const BUTTON_TITLE_MAX = 20
export const MAX_BUTTONS = 3
export const VARIABLE_RE = /^[a-zA-Z]\w*$/

// Targets a node can point to (undefined entries = "end flow", already omitted).
export function nodeTargets(node: FlowNode): string[] {
  switch (node.type) {
    case "message":
    case "question":
      return node.next ? [node.next] : []
    case "buttons":
      return [
        ...node.buttons.map((b) => b.next).filter((n): n is string => !!n),
        ...(node.fallbackNext ? [node.fallbackNext] : []),
      ]
    default:
      return []
  }
}

function textRequired(node: FlowNode): boolean {
  return node.type === "message" || node.type === "buttons" || node.type === "question"
}

export function validateFlow(definition: FlowDefinition): FlowIssue[] {
  const issues: FlowIssue[] = []
  const { entryNodeId, nodes } = definition
  const ids = nodes.map((n) => n.id)
  const idSet = new Set(ids)

  if (nodes.length === 0) {
    issues.push({ nodeId: null, message: "Add at least one node" })
    return issues
  }

  if (!entryNodeId) {
    issues.push({ nodeId: null, message: "Pick an entry node" })
  } else if (!idSet.has(entryNodeId)) {
    issues.push({ nodeId: null, message: `Entry node "${entryNodeId}" doesn't exist` })
  }

  const seen = new Set<string>()
  for (const node of nodes) {
    if (!node.id.trim()) {
      issues.push({ nodeId: node.id, message: "Node id is required" })
    } else if (node.id.length > NODE_ID_MAX) {
      issues.push({ nodeId: node.id, message: `Node id is limited to ${NODE_ID_MAX} characters` })
    }
    if (seen.has(node.id)) {
      issues.push({ nodeId: node.id, message: `Duplicate node id "${node.id}"` })
    }
    seen.add(node.id)

    const text = "text" in node ? node.text || "" : ""
    if (textRequired(node) && !text.trim()) {
      issues.push({ nodeId: node.id, message: "Text is required" })
    }
    if (text.length > TEXT_MAX) {
      issues.push({ nodeId: node.id, message: `Text is limited to ${TEXT_MAX} characters` })
    }

    if (node.type === "buttons") {
      if (node.buttons.length < 1 || node.buttons.length > MAX_BUTTONS) {
        issues.push({ nodeId: node.id, message: `Between 1 and ${MAX_BUTTONS} buttons` })
      }
      for (const b of node.buttons) {
        if (!b.title.trim()) issues.push({ nodeId: node.id, message: "Every button needs a title" })
        else if (b.title.length > BUTTON_TITLE_MAX)
          issues.push({
            nodeId: node.id,
            message: `Button titles are limited to ${BUTTON_TITLE_MAX} characters`,
          })
      }
    }

    if (node.type === "question") {
      if (!node.variable.trim()) {
        issues.push({ nodeId: node.id, message: "Variable name is required" })
      } else if (!VARIABLE_RE.test(node.variable) || node.variable.length > NODE_ID_MAX) {
        issues.push({
          nodeId: node.id,
          message: "Variable must start with a letter and contain only letters, digits or _",
        })
      }
    }

    for (const target of nodeTargets(node)) {
      if (!idSet.has(target)) {
        issues.push({ nodeId: node.id, message: `Points to unknown node "${target}"` })
      }
    }
  }

  // Unreachable nodes (BFS from entry)
  if (entryNodeId && idSet.has(entryNodeId)) {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const reachable = new Set<string>()
    const queue = [entryNodeId]
    while (queue.length) {
      const id = queue.shift()!
      if (reachable.has(id)) continue
      reachable.add(id)
      const node = byId.get(id)
      if (node) queue.push(...nodeTargets(node).filter((t) => byId.has(t)))
    }
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        issues.push({ nodeId: node.id, message: "Unreachable — nothing routes here from the entry node" })
      }
    }

    // Infinite message loop: a chain of message→next→…→message that returns to
    // itself with no waiting (buttons/question) or terminal node in between.
    for (const node of nodes) {
      if (node.type !== "message") continue
      let current: FlowNode | undefined = node
      const visited = new Set<string>()
      while (current && current.type === "message" && current.next) {
        if (visited.has(current.id)) break
        visited.add(current.id)
        const nextNode: FlowNode | undefined = byId.get(current.next)
        if (nextNode?.id === node.id) {
          issues.push({
            nodeId: node.id,
            message: "Message loop — auto-advancing messages cycle back here without waiting for input",
          })
          break
        }
        current = nextNode
      }
    }
  }

  // De-dupe identical issues (loops get reported from each member)
  const unique = new Map<string, FlowIssue>()
  for (const issue of issues) unique.set(`${issue.nodeId}|${issue.message}`, issue)
  return [...unique.values()]
}

// Rename a node and rewrite every reference to it (targets + entry).
export function renameNode(
  definition: FlowDefinition,
  oldId: string,
  newId: string
): FlowDefinition {
  const rewrite = (target?: string) => (target === oldId ? newId : target)
  return {
    entryNodeId: definition.entryNodeId === oldId ? newId : definition.entryNodeId,
    nodes: definition.nodes.map((node) => {
      const renamed = node.id === oldId ? { ...node, id: newId } : { ...node }
      switch (renamed.type) {
        case "message":
        case "question":
          return { ...renamed, next: rewrite(renamed.next) }
        case "buttons":
          return {
            ...renamed,
            fallbackNext: rewrite(renamed.fallbackNext),
            buttons: renamed.buttons.map((b) => ({ ...b, next: rewrite(b.next) })),
          }
        default:
          return renamed
      }
    }),
  }
}

// Backend 400s look like: `Node "X" points to unknown node "Y"` — pull out X.
export function parseFlowErrorNodeId(message: string): string | null {
  const m = message.match(/Node "([^"]+)"/i)
  return m ? m[1] : null
}

// Tokens available for text fields: built-ins + every question variable.
export function availableTokens(nodes: FlowNode[]): string[] {
  const vars = nodes
    .filter((n): n is Extract<FlowNode, { type: "question" }> => n.type === "question")
    .map((n) => n.variable)
    .filter((v) => VARIABLE_RE.test(v))
  return ["name", "waId", ...vars]
}

let nodeCounter = 0

export function generateNodeId(type: FlowNode["type"], existing: Set<string>): string {
  let id: string
  do {
    nodeCounter += 1
    id = `${type}-${nodeCounter}`
  } while (existing.has(id))
  return id
}

export function emptyNode(type: FlowNode["type"], id: string): FlowNode {
  switch (type) {
    case "message":
      return { id, type, text: "" }
    case "buttons":
      return { id, type, text: "", buttons: [{ title: "" }] }
    case "question":
      return { id, type, text: "", variable: "" }
    case "handoff":
      return { id, type }
    case "end":
      return { id, type }
  }
}
