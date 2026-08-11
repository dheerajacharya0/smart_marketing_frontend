import { describe, it, expect } from "vitest"
import { parseFlowErrorNodeId, availableTokens, generateNodeId } from "./flow-validation"
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
