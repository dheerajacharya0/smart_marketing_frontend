import { describe, expect, it } from "vitest"
import { FLOW_STARTERS, getFlowStarter } from "./flow-starters"
import { INDUSTRIES } from "./industry-flows"
import { SEGMENT_STARTERS, getSegmentStarter } from "./segment-starters"
import { validateFlow } from "./flow-validation"
import { buildRules, conditionError, operatorOptionsFor } from "./segment-rules"

/**
 * Starter libraries are plain data with no compiler check on the parts that
 * matter — a flow's graph wiring, a segment condition's operator. Both are easy
 * to break by editing the builder's rules later and forgetting the starters,
 * and the failure is silent: the user clicks a template and lands on a builder
 * that opens with validation errors already showing.
 *
 * These tests assert every shipped starter is valid on arrival.
 */

describe("flow starters", () => {
  it("ships at least one", () => {
    expect(FLOW_STARTERS.length).toBeGreaterThan(0)
  })

  it.each(FLOW_STARTERS.map((s) => [s.id, s] as const))(
    "%s passes validateFlow with no issues",
    (_id, starter) => {
      expect(validateFlow(starter.definition)).toEqual([])
    }
  )

  it.each(FLOW_STARTERS.map((s) => [s.id, s] as const))(
    "%s requires trigger keywords unless match type is any",
    (_id, starter) => {
      if (starter.triggerMatchType !== "any") {
        expect(starter.triggerKeywords.length).toBeGreaterThan(0)
      }
    }
  )

  it.each(FLOW_STARTERS.map((s) => [s.id, s] as const))(
    "%s avoids the built-in token names as question variables",
    (_id, starter) => {
      // `name` and `waId` are resolved by renderText ahead of collected
      // variables, so a question writing to either is silently shadowed.
      const shadowed = starter.definition.nodes
        .filter((n): n is Extract<typeof n, { type: "question" }> => n.type === "question")
        .filter((n) => n.variable === "name" || n.variable === "waId")
      expect(shadowed).toEqual([])
    }
  )

  it("has unique ids", () => {
    const ids = FLOW_STARTERS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("looks up by id and returns undefined for unknown ids", () => {
    expect(getFlowStarter(FLOW_STARTERS[0].id)?.id).toBe(FLOW_STARTERS[0].id)
    expect(getFlowStarter("nope")).toBeUndefined()
    expect(getFlowStarter(null)).toBeUndefined()
  })
})

describe("segment starters", () => {
  it("ships at least one", () => {
    expect(SEGMENT_STARTERS.length).toBeGreaterThan(0)
  })

  it.each(SEGMENT_STARTERS.map((s) => [s.id, s] as const))(
    "%s has no condition errors",
    (_id, starter) => {
      const errors = starter.conditions.map(conditionError).filter(Boolean)
      expect(errors).toEqual([])
    }
  )

  it.each(SEGMENT_STARTERS.map((s) => [s.id, s] as const))(
    "%s only uses operators the builder offers for that condition type",
    (_id, starter) => {
      for (const condition of starter.conditions) {
        const allowed = operatorOptionsFor(condition).map((o) => o.value)
        expect(allowed).toContain(condition.operator)
      }
    }
  )

  it.each(SEGMENT_STARTERS.map((s) => [s.id, s] as const))(
    "%s serializes to API rules",
    (_id, starter) => {
      const rules = buildRules(starter.combinator, starter.conditions)
      expect(rules.conditions.length).toBe(starter.conditions.length)
    }
  )

  it("has unique ids", () => {
    const ids = SEGMENT_STARTERS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("looks up by id and returns undefined for unknown ids", () => {
    expect(getSegmentStarter(SEGMENT_STARTERS[0].id)?.id).toBe(SEGMENT_STARTERS[0].id)
    expect(getSegmentStarter("nope")).toBeUndefined()
    expect(getSegmentStarter(null)).toBeUndefined()
  })
})

describe("industry flow packs", () => {
  it("files every flow starter under a known industry", () => {
    const known = new Set<string>(INDUSTRIES.map((i) => i.id))
    for (const s of FLOW_STARTERS) expect(known.has(s.industry ?? "missing")).toBe(true)
  })

  it.each(INDUSTRIES.map((i) => [i.id] as const))("ships at least one flow for %s", (id) => {
    expect(FLOW_STARTERS.some((s) => s.industry === id)).toBe(true)
  })

  // Two starters from one pack, both active, must not answer the same message.
  it.each(INDUSTRIES.map((i) => [i.id] as const))("%s flows don't share trigger keywords", (id) => {
    const keywords = FLOW_STARTERS.filter((s) => s.industry === id).flatMap((s) =>
      s.triggerKeywords.map((k) => k.toLowerCase())
    )
    expect(new Set(keywords).size).toBe(keywords.length)
  })
})
