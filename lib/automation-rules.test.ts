import { describe, expect, it } from "vitest"
import type { AutomationAction, AutomationRule, AutomationTrigger } from "@/services/api"
import {
  ACTIONS_MAX,
  CONDITIONS_MAX,
  NO_REPLY_HOURS_MAX,
  PRIORITY_MAX,
  attributeOperatorTakesValue,
  defaultAction,
  defaultCondition,
  defaultTrigger,
  describeAction,
  describeTrigger,
  isCatchAll,
  normalizeConditions,
  shadowedBy,
  validateRule,
} from "./automation-rules"

const UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
const OTHER_UUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

function rule(
  overrides: Partial<Parameters<typeof validateRule>[0]> = {}
): Parameters<typeof validateRule>[0] {
  return {
    name: "Opening hours",
    phoneNumberId: "123456789",
    trigger: { type: "keyword", matchType: "contains", keywords: ["hours"] },
    actions: [{ type: "send_text", text: "We're open 9-8." }],
    ...overrides,
  }
}

const messages = (issues: { message: string }[]) => issues.map((i) => i.message)

describe("validateRule — the parts the server would 400 on", () => {
  it("accepts a minimal valid rule", () => {
    expect(validateRule(rule())).toEqual([])
  })

  it("requires keywords unless the match is the catch-all", () => {
    const withoutKeywords = validateRule(
      rule({ trigger: { type: "keyword", matchType: "contains", keywords: [] } })
    )
    expect(messages(withoutKeywords)).toContain("Add at least one keyword")

    // The one cross-field rule the backend checks outside its schema.
    expect(
      validateRule(rule({ trigger: { type: "keyword", matchType: "any", keywords: [] } }))
    ).toEqual([])
  })

  it("lets a button trigger carry no ids (= any button)", () => {
    expect(validateRule(rule({ trigger: { type: "button", buttonIds: [] } }))).toEqual([])
  })

  it("requires a tag on tag_added", () => {
    const issues = validateRule(rule({ trigger: { type: "tag_added", tag: "  " } }))
    expect(issues).toHaveLength(1)
    expect(issues[0].field).toBe("trigger")
  })

  it("caps no_reply at 30 days and rejects fractions", () => {
    expect(validateRule(rule({ trigger: { type: "no_reply", hours: NO_REPLY_HOURS_MAX } }))).toEqual(
      []
    )
    expect(
      validateRule(rule({ trigger: { type: "no_reply", hours: NO_REPLY_HOURS_MAX + 1 } }))
    ).toHaveLength(1)
    expect(validateRule(rule({ trigger: { type: "no_reply", hours: 0 } }))).toHaveLength(1)
    expect(validateRule(rule({ trigger: { type: "no_reply", hours: 1.5 } }))).toHaveLength(1)
  })

  it("requires at least one action and caps the list", () => {
    expect(messages(validateRule(rule({ actions: [] })))).toContain("Add at least one action")

    const tooMany: AutomationAction[] = Array.from({ length: ACTIONS_MAX + 1 }, () => ({
      type: "add_tag" as const,
      tag: "vip",
    }))
    expect(messages(validateRule(rule({ actions: tooMany })))).toContain(
      `At most ${ACTIONS_MAX} actions`
    )
  })

  it("reports every bad action row, not just the first", () => {
    const issues = validateRule(
      rule({
        actions: [
          { type: "send_text", text: "" },
          { type: "start_flow", flowId: "not-a-uuid" },
        ],
      })
    )
    expect(issues.map((i) => i.index)).toEqual([0, 1])
  })

  it("requires real uuids for the id-carrying actions", () => {
    expect(validateRule(rule({ actions: [{ type: "start_flow", flowId: UUID }] }))).toEqual([])
    expect(
      validateRule(rule({ actions: [{ type: "assign_agent", agentUserId: "42" }] }))
    ).toHaveLength(1)
  })

  it("only accepts http(s) webhook urls", () => {
    expect(
      validateRule(rule({ actions: [{ type: "call_webhook", url: "https://a.example/hook" }] }))
    ).toEqual([])
    // A bare host parses as nothing; javascript: parses but isn't a webhook.
    expect(
      validateRule(rule({ actions: [{ type: "call_webhook", url: "example.com/hook" }] }))
    ).toHaveLength(1)
    expect(
      validateRule(rule({ actions: [{ type: "call_webhook", url: "javascript:alert(1)" }] }))
    ).toHaveLength(1)
  })

  it("treats a template with no language as broken", () => {
    // Language is copied from the picked template, so an empty one means the
    // selection and the template list have gone out of step.
    const issues = validateRule(
      rule({ actions: [{ type: "send_template", templateName: "hello", templateLanguage: "" }] })
    )
    expect(issues).toHaveLength(1)
  })

  it("rejects an empty condition group — the server does too", () => {
    const issues = validateRule(rule({ conditions: { combinator: "and", conditions: [] } }))
    expect(messages(issues)).toContain("Remove the condition group or add a condition")
  })

  it("caps the condition list", () => {
    const conditions = Array.from({ length: CONDITIONS_MAX + 1 }, () => ({
      type: "tag" as const,
      operator: "has" as const,
      value: "vip",
    }))
    expect(messages(validateRule(rule({ conditions: { combinator: "and", conditions } })))).toContain(
      `At most ${CONDITIONS_MAX} conditions`
    )
  })

  it("only demands a value for attribute operators that compare one", () => {
    expect(
      validateRule(
        rule({
          conditions: {
            combinator: "and",
            conditions: [{ type: "attribute", key: "city", operator: "exists" }],
          },
        })
      )
    ).toEqual([])

    expect(
      validateRule(
        rule({
          conditions: {
            combinator: "and",
            conditions: [{ type: "attribute", key: "city", operator: "equals", value: "" }],
          },
        })
      )
    ).toHaveLength(1)
  })

  it("bounds priority", () => {
    expect(validateRule(rule({ priority: PRIORITY_MAX }))).toEqual([])
    expect(validateRule(rule({ priority: PRIORITY_MAX + 1 }))).toHaveLength(1)
    expect(validateRule(rule({ priority: -1 }))).toHaveLength(1)
  })
})

describe("defaults", () => {
  it("produces a valid starting point for every trigger type", () => {
    // A default that fails validation would open the form already in error.
    for (const type of ["button", "new_contact", "no_reply"] as const) {
      expect(validateRule(rule({ trigger: defaultTrigger(type) }))).toEqual([])
    }
    // These two need a value the user must supply, so they start invalid on purpose.
    expect(validateRule(rule({ trigger: defaultTrigger("tag_added") }))).toHaveLength(1)
    expect(validateRule(rule({ trigger: defaultTrigger("keyword") }))).toHaveLength(1)
  })

  it("hides the value input only for exists/not_exists", () => {
    expect(attributeOperatorTakesValue("equals")).toBe(true)
    expect(attributeOperatorTakesValue("exists")).toBe(false)
    expect(attributeOperatorTakesValue("not_exists")).toBe(false)
  })

  it("defaults a webhook to sending contact details", () => {
    expect(defaultAction("call_webhook")).toEqual({
      type: "call_webhook",
      url: "",
      includeContact: true,
    })
  })

  it("defaults a condition to a tag check", () => {
    expect(defaultCondition("tag").type).toBe("tag")
  })
})

describe("normalizeConditions", () => {
  it("turns an emptied group into null rather than an empty list", () => {
    expect(normalizeConditions({ combinator: "and", conditions: [] })).toBeNull()
    expect(normalizeConditions(null)).toBeNull()
    expect(normalizeConditions(undefined)).toBeNull()
  })

  it("passes a populated group through untouched", () => {
    const conditions = {
      combinator: "or" as const,
      conditions: [{ type: "opted_in" as const, value: true }],
    }
    expect(normalizeConditions(conditions)).toBe(conditions)
  })
})

describe("describeTrigger / describeAction", () => {
  it("reads as a sentence for each trigger", () => {
    expect(describeTrigger({ type: "keyword", matchType: "any", keywords: [] })).toBe(
      "Any inbound message"
    )
    expect(describeTrigger({ type: "keyword", matchType: "exact", keywords: ["hi", "hello"] })).toBe(
      "Message is hi, hello"
    )
    expect(describeTrigger({ type: "button", buttonIds: [] })).toBe("Any button tap")
    expect(describeTrigger({ type: "no_reply", hours: 48 })).toBe("No reply for 48h")
  })

  it("resolves ids to names so a rule never reads as a uuid", () => {
    expect(
      describeAction({ type: "start_flow", flowId: UUID }, { flows: { [UUID]: "Welcome bot" } })
    ).toBe("Start flow Welcome bot")
    expect(
      describeAction(
        { type: "assign_agent", agentUserId: UUID },
        { agents: { [UUID]: "Priya" } }
      )
    ).toBe("Assign to Priya")
  })

  it("falls back to the stored name when the lookup misses", () => {
    // An agent removed from the team still has their name on the rule.
    expect(describeAction({ type: "assign_agent", agentUserId: UUID, agentName: "Ex-agent" })).toBe(
      "Assign to Ex-agent"
    )
  })
})

describe("shadowedBy", () => {
  const base = {
    phoneNumberId: "123",
    isActive: true,
    conditions: null,
  }
  const catchAll: AutomationTrigger = { type: "keyword", matchType: "any", keywords: [] }
  const keyword: AutomationTrigger = { type: "keyword", matchType: "contains", keywords: ["hi"] }

  it("flags a keyword rule sitting behind an unconditional catch-all", () => {
    const rules = [
      { ...base, id: "a", priority: 0, trigger: catchAll },
      { ...base, id: "b", priority: 10, trigger: keyword },
    ]
    expect(shadowedBy(rules[1], rules).map((r) => r.id)).toEqual(["a"])
    // The catch-all itself is not shadowed by anything.
    expect(shadowedBy(rules[0], rules)).toEqual([])
  })

  it("counts an equal priority as shadowing — the server orders by priority alone", () => {
    const rules = [
      { ...base, id: "a", priority: 5, trigger: catchAll },
      { ...base, id: "b", priority: 5, trigger: keyword },
    ]
    expect(shadowedBy(rules[1], rules)).toHaveLength(1)
  })

  it("ignores a catch-all that runs later", () => {
    const rules = [
      { ...base, id: "a", priority: 20, trigger: catchAll },
      { ...base, id: "b", priority: 10, trigger: keyword },
    ]
    expect(shadowedBy(rules[1], rules)).toEqual([])
  })

  it("ignores inactive rules on both sides", () => {
    const rules = [
      { ...base, id: "a", priority: 0, trigger: catchAll, isActive: false },
      { ...base, id: "b", priority: 10, trigger: keyword },
    ]
    expect(shadowedBy(rules[1], rules)).toEqual([])

    const inactiveTarget = [
      { ...base, id: "a", priority: 0, trigger: catchAll },
      { ...base, id: "b", priority: 10, trigger: keyword, isActive: false },
    ]
    expect(shadowedBy(inactiveTarget[1], inactiveTarget)).toEqual([])
  })

  it("ignores a conditional catch-all — it can decline to fire", () => {
    const rules = [
      {
        ...base,
        id: "a",
        priority: 0,
        trigger: catchAll,
        conditions: { combinator: "and" as const, conditions: [{ type: "opted_in" as const, value: true }] },
      },
      { ...base, id: "b", priority: 10, trigger: keyword },
    ]
    expect(shadowedBy(rules[1], rules)).toEqual([])
  })

  it("never crosses trigger types — the engine matches on type first", () => {
    // A keyword catch-all can't shadow a new_contact or button rule; those are
    // different events entirely.
    const rules = [
      { ...base, id: "a", priority: 0, trigger: catchAll },
      { ...base, id: "b", priority: 10, trigger: { type: "new_contact" } as AutomationTrigger },
      { ...base, id: "c", priority: 10, trigger: { type: "button", buttonIds: [] } as AutomationTrigger },
    ]
    expect(shadowedBy(rules[1], rules)).toEqual([])
    expect(shadowedBy(rules[2], rules)).toEqual([])
  })

  it("stays within one phone number", () => {
    const rules = [
      { ...base, id: "a", priority: 0, trigger: catchAll, phoneNumberId: "999" },
      { ...base, id: "b", priority: 10, trigger: keyword },
    ]
    expect(shadowedBy(rules[1], rules)).toEqual([])
  })
})

describe("isCatchAll", () => {
  it("is true only for the any-match keyword trigger", () => {
    expect(isCatchAll({ type: "keyword", matchType: "any", keywords: [] })).toBe(true)
    expect(isCatchAll({ type: "keyword", matchType: "contains", keywords: ["hi"] })).toBe(false)
    expect(isCatchAll({ type: "button", buttonIds: [] })).toBe(false)
  })
})

describe("the persisted rule shape", () => {
  it("keeps triggerType in step with trigger.type", () => {
    // The server denormalizes triggerType for its index; reading either has to
    // give the same answer, so the type must allow nothing else.
    const persisted: Pick<AutomationRule, "trigger" | "triggerType"> = {
      trigger: { type: "no_reply", hours: 24 },
      triggerType: "no_reply",
    }
    expect(persisted.triggerType).toBe(persisted.trigger.type)
  })

  it("distinguishes two agents by id, not name", () => {
    expect(
      describeAction(
        { type: "assign_agent", agentUserId: OTHER_UUID },
        { agents: { [UUID]: "Priya", [OTHER_UUID]: "Sam" } }
      )
    ).toBe("Assign to Sam")
  })
})
