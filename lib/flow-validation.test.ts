import { describe, it, expect } from "vitest"
import { parseFlowErrorNodeId, availableTokens, generateNodeId, validateFlow, evaluateBranch, formatDelayMinutes, emptyNode, MAX_DELAY_MINUTES } from "./flow-validation"
import type { FlowNode } from "@/services/api"

describe("parseFlowErrorNodeId", () => {
  it("extracts the quoted node id from a backend error", () => {
    expect(parseFlowErrorNodeId('Node "welcome-1" has a dead link')).toBe("welcome-1")
  })
  it("returns null when no node id is present", () => {
    expect(parseFlowErrorNodeId("something went wrong")).toBeNull()
  })
})

describe("availableTokens", () => {
  it("includes built-ins plus valid question variables", () => {
    const nodes = [
      { id: "q1", type: "question", text: "Name?", variable: "customerName" },
      { id: "q2", type: "question", text: "Bad?", variable: "1invalid" },
      { id: "m1", type: "message", text: "hi" },
    ] as unknown as FlowNode[]
    expect(availableTokens(nodes)).toEqual(["name", "waId", "customerName"])
  })
})

describe("generateNodeId", () => {
  it("produces a type-prefixed id that avoids collisions", () => {
    const existing = new Set<string>(["message-1"])
    const id = generateNodeId("message", existing)
    expect(id.startsWith("message-")).toBe(true)
    expect(existing.has(id)).toBe(false)
  })
})

const msg = (id: string, next?: string): FlowNode => ({ id, type: "message", text: "hi", next })
const end = (id: string): FlowNode => ({ id, type: "end" })

describe("condition nodes", () => {
  const flowWith = (nodes: FlowNode[]) => ({ entryNodeId: nodes[0].id, nodes })

  it("accepts a well-formed branch", () => {
    expect(
      validateFlow(
        flowWith([
          { id: "c", type: "condition", branches: [{ variable: "size", operator: "equals", value: "big", next: "e" }], defaultNext: "e" },
          end("e"),
        ])
      )
    ).toEqual([])
  })

  it("requires a value for comparing operators and forbids one otherwise", () => {
    // Both halves are server-enforced: a comparison against nothing, and a
    // value the engine would silently ignore.
    const missing = validateFlow(
      flowWith([
        { id: "c", type: "condition", branches: [{ variable: "size", operator: "equals", next: "e" }] },
        end("e"),
      ])
    )
    expect(missing.some((i) => i.message.includes("needs a value"))).toBe(true)

    const stray = validateFlow(
      flowWith([
        { id: "c", type: "condition", branches: [{ variable: "size", operator: "is_set", value: "x", next: "e" }] },
        end("e"),
      ])
    )
    expect(stray.some((i) => i.message.includes("takes no value"))).toBe(true)
  })

  it("flags a branch with no destination and an unknown target", () => {
    const issues = validateFlow(
      flowWith([
        { id: "c", type: "condition", branches: [{ variable: "v", operator: "is_set", next: "" }, { variable: "v", operator: "is_empty", next: "nope" }] },
        end("e"),
      ])
    )
    expect(issues.some((i) => i.message.includes("needs somewhere to go"))).toBe(true)
    expect(issues.some((i) => i.message.includes('unknown node "nope"'))).toBe(true)
  })
})

describe("delay nodes", () => {
  it("accepts a delay inside the 24-hour cap and rejects one past it", () => {
    const at = (minutes: number) =>
      validateFlow({
        entryNodeId: "d",
        nodes: [{ id: "d", type: "delay", minutes, next: "e" }, end("e")],
      })
    expect(at(MAX_DELAY_MINUTES)).toEqual([])
    expect(at(MAX_DELAY_MINUTES + 1)).toHaveLength(1)
    expect(at(0)).toHaveLength(1)
    expect(at(1.5)).toHaveLength(1)
  })

  it("allows a loop that passes through a delay", () => {
    // A recurring reminder is a legitimate flow: the delay breaks the cycle by
    // waiting on a timer, so it never spins inside one webhook request.
    expect(
      validateFlow({
        entryNodeId: "m",
        nodes: [msg("m", "d"), { id: "d", type: "delay", minutes: 60, next: "m" }],
      })
    ).toEqual([])
  })
})

describe("synchronous cycles", () => {
  it("rejects a message↔condition loop that never waits", () => {
    const issues = validateFlow({
      entryNodeId: "m",
      nodes: [
        msg("m", "c"),
        { id: "c", type: "condition", branches: [{ variable: "v", operator: "is_set", next: "m" }] },
      ],
    })
    expect(issues.some((i) => i.message.includes("Infinite loop"))).toBe(true)
  })

  it("allows a loop broken by a question", () => {
    expect(
      validateFlow({
        entryNodeId: "m",
        nodes: [msg("m", "q"), { id: "q", type: "question", text: "?", variable: "v", next: "m" }],
      })
    ).toEqual([])
  })
})

describe("evaluateBranch", () => {
  const vars = { size: "Big", count: "12", blank: "" }

  it("compares trimmed and case-insensitively", () => {
    // Both sides are human-typed; "Yes" and "yes" taking different branches is
    // a bug report every time.
    expect(evaluateBranch({ variable: "size", operator: "equals", value: " big ", next: "x" }, vars)).toBe(true)
    expect(evaluateBranch({ variable: "size", operator: "contains", value: "IG", next: "x" }, vars)).toBe(true)
    expect(evaluateBranch({ variable: "size", operator: "not_equals", value: "small", next: "x" }, vars)).toBe(true)
  })

  it("treats is_set/is_empty as presence checks", () => {
    expect(evaluateBranch({ variable: "size", operator: "is_set", next: "x" }, vars)).toBe(true)
    expect(evaluateBranch({ variable: "blank", operator: "is_set", next: "x" }, vars)).toBe(false)
    expect(evaluateBranch({ variable: "missing", operator: "is_empty", next: "x" }, vars)).toBe(true)
  })

  it("compares numbers numerically", () => {
    expect(evaluateBranch({ variable: "count", operator: "gt", value: "9", next: "x" }, vars)).toBe(true)
    expect(evaluateBranch({ variable: "count", operator: "lte", value: "12", next: "x" }, vars)).toBe(true)
  })

  it("is false, not an error, when a numeric comparison isn't numeric", () => {
    // Mid-conversation this runs on a contact holding a phone: a malformed
    // comparison must send them down the default branch, not strand them.
    expect(evaluateBranch({ variable: "size", operator: "gt", value: "3", next: "x" }, vars)).toBe(false)
    expect(evaluateBranch({ variable: "count", operator: "lt", value: "abc", next: "x" }, vars)).toBe(false)
  })

  it("resolves {{tokens}} on the compared value", () => {
    expect(
      evaluateBranch({ variable: "size", operator: "equals", value: "{{other}}", next: "x" }, { size: "big", other: "Big" })
    ).toBe(true)
  })
})

describe("formatDelayMinutes", () => {
  it("reads as a human duration", () => {
    expect(formatDelayMinutes(45)).toBe("45m")
    expect(formatDelayMinutes(60)).toBe("1h")
    expect(formatDelayMinutes(150)).toBe("2h 30m")
    expect(formatDelayMinutes(0)).toBe("—")
  })
})
