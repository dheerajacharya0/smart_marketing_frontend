import { describe, expect, it } from "vitest"
import type { FlowDefinition, FlowNode } from "@/services/api"
import { appendButton, portsForNode, setPortTarget, removeNodeFromDefinition } from "@/lib/flow-graph"
import { autoLayout } from "@/lib/flow-layout"
import { validateFlow } from "@/lib/flow-validation"

const buttons: FlowNode = {
  id: "menu",
  type: "buttons",
  text: "Pick one",
  buttons: [
    { title: "Sales", next: "sales" },
    { title: "Support" },
  ],
  fallbackNext: "sales",
}

const condition: FlowNode = {
  id: "check",
  type: "condition",
  branches: [
    { variable: "answer", operator: "equals", value: "yes", next: "sales" },
    { variable: "answer", operator: "is_set", next: "" },
  ],
}

describe("portsForNode", () => {
  it("gives each button its own port so an edge names the button it came from", () => {
    const ports = portsForNode(buttons)
    expect(ports.map((p) => p.id)).toEqual(["btn:0", "btn:1", "fallback"])
    expect(ports[0]).toMatchObject({ label: "Sales", target: "sales", required: true })
    // An untitled button still needs a stable label to draw next to its handle.
    expect(ports[1]).toMatchObject({ target: undefined, required: true })
    expect(ports[2]).toMatchObject({ label: "other reply", target: "sales", required: false })
  })

  it("labels a branch with its comparison, and drops the value for valueless operators", () => {
    const ports = portsForNode(condition)
    expect(ports[0].label).toBe("answer is exactly yes")
    expect(ports[1].label).toBe("answer was answered")
    expect(ports[2]).toMatchObject({ id: "default", target: undefined, required: false })
  })

  it("marks a delay's target required and a message's optional", () => {
    const delay: FlowNode = { id: "wait", type: "delay", minutes: 30, next: "" }
    expect(portsForNode(delay)).toEqual([
      { id: "next", label: "then", target: undefined, required: true },
    ])
    const message: FlowNode = { id: "hi", type: "message", text: "Hello" }
    expect(portsForNode(message)[0].required).toBe(false)
  })

  it("gives terminal nodes nothing to connect from", () => {
    expect(portsForNode({ id: "bye", type: "end" })).toEqual([])
    expect(portsForNode({ id: "agent", type: "handoff" })).toEqual([])
  })
})

describe("setPortTarget", () => {
  it("writes only the port it was given", () => {
    const updated = setPortTarget(buttons, "btn:1", "support") as Extract<FlowNode, { type: "buttons" }>
    expect(updated.buttons.map((b) => b.next)).toEqual(["sales", "support"])
    expect(updated.fallbackNext).toBe("sales")
  })

  it("clears an optional target to undefined and a required one to an empty string", () => {
    const cleared = setPortTarget(buttons, "fallback", undefined) as Extract<FlowNode, { type: "buttons" }>
    expect(cleared.fallbackNext).toBeUndefined()

    // A required target keeps the key so validation reports "needs a target"
    // rather than the backend rejecting the node's shape.
    const delay: FlowNode = { id: "wait", type: "delay", minutes: 30, next: "sales" }
    const clearedDelay = setPortTarget(delay, "next", undefined) as Extract<FlowNode, { type: "delay" }>
    expect(clearedDelay.next).toBe("")

    const clearedBranch = setPortTarget(condition, "branch:0", undefined) as Extract<
      FlowNode,
      { type: "condition" }
    >
    expect(clearedBranch.branches[0].next).toBe("")
  })

  it("ignores a port that does not belong to the node", () => {
    expect(setPortTarget(buttons, "branch:0", "sales")).toBe(buttons)
    expect(setPortTarget({ id: "bye", type: "end" }, "next", "sales")).toEqual({ id: "bye", type: "end" })
  })
})

describe("appendButton", () => {
  const withIds: Extract<FlowNode, { type: "buttons" }> = {
    id: "menu",
    type: "buttons",
    text: "Pick one",
    buttons: [
      { id: "menu-0", title: "Sales", next: "sales" },
      { id: "menu-1", title: "Support", next: "sales" },
    ],
  }

  it("gives the new button the next free id", () => {
    const after = appendButton(withIds) as Extract<FlowNode, { type: "buttons" }>
    expect(after.buttons.map((b) => b.id)).toEqual(["menu-0", "menu-1", "menu-2"])
    expect(after.buttons[2].title).toBe("")
  })

  it("skips an id the server would derive for a surviving button", () => {
    // Delete the first of menu-0/menu-1, then add: the naive id for index 1 is
    // "menu-1", which the surviving button still carries — the server rejects
    // that save as a duplicate button id.
    const afterDelete: Extract<FlowNode, { type: "buttons" }> = {
      ...withIds,
      buttons: [withIds.buttons[1]],
    }
    const after = appendButton(afterDelete) as Extract<FlowNode, { type: "buttons" }>
    const ids = after.buttons.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(["menu-1", "menu-2"])
  })

  it("fills in ids for buttons that never had one, without rewriting the rest", () => {
    const after = appendButton(buttons as Extract<FlowNode, { type: "buttons" }>) as Extract<
      FlowNode,
      { type: "buttons" }
    >
    // An id an in-flight tap is matched on is never reassigned; the id-less
    // ones take what the server would have derived from their index anyway.
    expect(after.buttons.map((b) => b.id)).toEqual(["menu-0", "menu-1", "menu-2"])
    expect(after.buttons.map((b) => b.title)).toEqual(["Sales", "Support", ""])
  })
})

describe("removeNodeFromDefinition", () => {
  it("clears references from every node type, not just the ones with a plain next", () => {
    const definition: FlowDefinition = {
      entryNodeId: "menu",
      nodes: [
        buttons,
        condition,
        { id: "ask", type: "question", text: "Name?", variable: "answer", next: "sales" },
        { id: "wait", type: "delay", minutes: 30, next: "sales" },
        { id: "sales", type: "message", text: "A rep will call" },
      ],
    }

    const after = removeNodeFromDefinition(definition, "sales")
    expect(after.nodes.map((n) => n.id)).toEqual(["menu", "check", "ask", "wait"])
    // The point of the exercise: nothing still points at the deleted node, so
    // the backend can't reject the save with `points to unknown node`.
    expect(validateFlow(after).some((i) => i.message.includes("sales"))).toBe(false)
  })

  it("drops the entry point when the entry node itself is deleted", () => {
    const definition: FlowDefinition = {
      entryNodeId: "only",
      nodes: [{ id: "only", type: "message", text: "Hi" }],
    }
    expect(removeNodeFromDefinition(definition, "only")).toEqual({ entryNodeId: "", nodes: [] })
  })
})

describe("autoLayout", () => {
  const definition: FlowDefinition = {
    entryNodeId: "start",
    nodes: [
      { id: "start", type: "message", text: "Hi", next: "menu" },
      buttons,
      { id: "sales", type: "message", text: "A rep will call" },
      { id: "orphan", type: "message", text: "Unreachable" },
    ],
  }

  it("places each node one column past the node that reaches it", () => {
    const layout = autoLayout(definition)
    expect(layout.start.x).toBeLessThan(layout.menu.x)
    expect(layout.menu.x).toBeLessThan(layout.sales.x)
    expect(layout.start.y).toBe(layout.menu.y)
  })

  it("keeps unreachable nodes on the canvas, off to the side", () => {
    const layout = autoLayout(definition)
    expect(layout.orphan).toBeDefined()
    expect(layout.orphan.x).toBeGreaterThan(layout.sales.x)
  })

  it("is deterministic — the same definition always lays out the same way", () => {
    expect(autoLayout(definition)).toEqual(autoLayout(definition))
  })

  it("survives a definition with no entry node set", () => {
    const layout = autoLayout({ entryNodeId: "", nodes: definition.nodes })
    expect(Object.keys(layout).sort()).toEqual(["menu", "orphan", "sales", "start"])
  })
})
