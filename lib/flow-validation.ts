import type { FlowConditionBranch, FlowConditionOperator, FlowDefinition, FlowNode } from "@/services/api"

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
export const MAX_BRANCHES = 10
export const CONDITION_VALUE_MAX = 1024
/**
 * A delay can hold a flow for at most a day. Not arbitrary: flow nodes send
 * free-form text, which the Cloud API refuses outside the 24-hour customer
 * service window, so a longer delay would build a node that always fails at
 * send time with nothing in the flow to explain it. A follow-up days later is
 * what drip sequences are for — they send templates.
 */
export const MAX_DELAY_MINUTES = 24 * 60
export const VARIABLE_RE = /^[a-zA-Z]\w*$/

/** Operators that compare against nothing — a `value` on these is rejected. */
export const VALUELESS_OPERATORS: FlowConditionOperator[] = ["is_set", "is_empty"]

export function operatorTakesValue(operator: FlowConditionOperator): boolean {
  return !VALUELESS_OPERATORS.includes(operator)
}

// Targets a node can point to (undefined entries = "end flow", already omitted).
export function nodeTargets(node: FlowNode): string[] {
  switch (node.type) {
    case "message":
    case "question":
      return node.next ? [node.next] : []
    case "delay":
      return node.next ? [node.next] : []
    case "buttons":
      return [
        ...node.buttons.map((b) => b.next).filter((n): n is string => !!n),
        ...(node.fallbackNext ? [node.fallbackNext] : []),
      ]
    case "condition":
      return [
        ...node.branches.map((b) => b.next).filter((n): n is string => !!n),
        ...(node.defaultNext ? [node.defaultNext] : []),
      ]
    default:
      return []
  }
}

function textRequired(node: FlowNode): boolean {
  return node.type === "message" || node.type === "buttons" || node.type === "question"
}

/**
 * Advances the walk without stopping. A loop between these spins inside a
 * single webhook request rather than misbehaving visibly — which is why a loop
 * through a delay is fine (it waits on a timer) and one through messages and
 * conditions is not.
 */
function isSynchronous(node: FlowNode): boolean {
  return node.type === "message" || node.type === "condition"
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

    if (node.type === "condition") {
      if (node.branches.length < 1 || node.branches.length > MAX_BRANCHES) {
        issues.push({ nodeId: node.id, message: `Between 1 and ${MAX_BRANCHES} branches` })
      }
      for (const branch of node.branches) {
        if (!branch.variable.trim()) {
          issues.push({ nodeId: node.id, message: "Every branch needs an answer to check" })
        }
        if (!branch.next) {
          issues.push({ nodeId: node.id, message: "Every branch needs somewhere to go" })
        }
        // The server rejects both halves of this: a comparison with nothing to
        // compare against, and a value on an operator that ignores it — which
        // would leave the builder showing a comparison the engine never makes.
        const needsValue = operatorTakesValue(branch.operator)
        if (needsValue && !branch.value?.trim()) {
          issues.push({
            nodeId: node.id,
            message: `"${branch.operator.replace(/_/g, " ")}" needs a value to compare against`,
          })
        }
        if (!needsValue && branch.value !== undefined) {
          issues.push({
            nodeId: node.id,
            message: `"${branch.operator.replace(/_/g, " ")}" takes no value`,
          })
        }
        if ((branch.value?.length ?? 0) > CONDITION_VALUE_MAX) {
          issues.push({
            nodeId: node.id,
            message: `Compared values are limited to ${CONDITION_VALUE_MAX} characters`,
          })
        }
      }
    }

    if (node.type === "delay") {
      if (!Number.isInteger(node.minutes) || node.minutes < 1 || node.minutes > MAX_DELAY_MINUTES) {
        issues.push({
          nodeId: node.id,
          message: `Delay must be a whole number of minutes between 1 and ${MAX_DELAY_MINUTES} (24 hours)`,
        })
      }
      if (!node.next) {
        issues.push({ nodeId: node.id, message: "A delay needs a node to continue to" })
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

    // Infinite *synchronous* cycle: messages and conditions advance the walk
    // without stopping, so a loop between them spins inside one webhook request.
    // Buttons and questions break a cycle by waiting for a reply, and a delay
    // breaks it by waiting for a timer — a loop through a delay is a recurring
    // reminder, a legitimate thing to build.
    const state = new Map<string, "visiting" | "done">()
    const reported = new Set<string>()
    const walkSync = (node: FlowNode, start: string) => {
      if (state.get(node.id) === "done") return
      if (state.get(node.id) === "visiting") {
        if (!reported.has(start)) {
          reported.add(start)
          issues.push({
            nodeId: start,
            message:
              "Infinite loop — these nodes advance without stopping. Add a question, buttons, a delay or an end node.",
          })
        }
        return
      }
      state.set(node.id, "visiting")
      for (const target of nodeTargets(node)) {
        const next = byId.get(target)
        if (next && isSynchronous(next)) walkSync(next, start)
      }
      state.set(node.id, "done")
    }
    for (const node of nodes) {
      if (isSynchronous(node)) walkSync(node, node.id)
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
        case "condition":
          return {
            ...renamed,
            defaultNext: rewrite(renamed.defaultNext),
            branches: renamed.branches.map((b) => ({ ...b, next: rewrite(b.next) ?? "" })),
          }
        case "delay":
          return { ...renamed, next: rewrite(renamed.next) ?? "" }
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
    case "condition":
      // Starts with one branch and no default: "anything else ends the flow" is
      // the safer opening position, and a default is one click away.
      return { id, type, branches: [{ variable: "", operator: "equals", value: "", next: "" }] }
    case "delay":
      return { id, type, minutes: 60, next: "" }
    case "handoff":
      return { id, type }
    case "end":
      return { id, type }
  }
}

/** Plain-language operator labels for the branch editor. */
export const CONDITION_OPERATOR_OPTIONS: { value: FlowConditionOperator; label: string }[] = [
  { value: "equals", label: "is exactly" },
  { value: "not_equals", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "doesn't contain" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "is_set", label: "was answered" },
  { value: "is_empty", label: "was left blank" },
  { value: "gt", label: "is greater than" },
  { value: "gte", label: "is at least" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is at most" },
]

/**
 * Mirrors the engine's comparison so the simulator takes the branch the real
 * flow would.
 *
 * Both sides are trimmed and compared case-insensitively: they're things humans
 * typed, one into WhatsApp and one into a builder, and "Yes" taking a different
 * branch from "yes" is a bug report every time. Numeric operators are **false
 * rather than an error** when either side isn't a number — this runs
 * mid-conversation, and a contact holding a phone must not be stranded by a
 * malformed comparison; they take the default branch, a path the author chose.
 */
export function evaluateBranch(
  branch: FlowConditionBranch,
  variables: Record<string, string>
): boolean {
  const raw = variables[branch.variable]
  const left = (raw ?? "").trim()

  if (branch.operator === "is_set") return left.length > 0
  if (branch.operator === "is_empty") return left.length === 0

  const right = substituteBranchTokens(branch.value ?? "", variables).trim()

  switch (branch.operator) {
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = Number(left)
      const b = Number(right)
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false
      if (branch.operator === "gt") return a > b
      if (branch.operator === "gte") return a >= b
      if (branch.operator === "lt") return a < b
      return a <= b
    }
    default: {
      const a = left.toLowerCase()
      const b = right.toLowerCase()
      switch (branch.operator) {
        case "equals":
          return a === b
        case "not_equals":
          return a !== b
        case "contains":
          return a.includes(b)
        case "not_contains":
          return !a.includes(b)
        case "starts_with":
          return a.startsWith(b)
        case "ends_with":
          return a.endsWith(b)
        default:
          return false
      }
    }
  }
}

/** `{{token}}` substitution for a compared value — how one answer is compared to another. */
function substituteBranchTokens(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, token: string) => variables[token] ?? "")
}

/** "2h 30m" from a minute count, for delay summaries. */
export function formatDelayMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—"
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}
